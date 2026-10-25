'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — صفحة الحقيبة: التفاصيل، المهارات (مع الأطر المرجعية)، الملفات والتنزيل الآمن، بوابة الوصول بالبريد

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import type { IconName } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { UI, t, fmtDate, programName } from '../../../lib/portal/content';
import { typeLabel, typeIcon, levelLabel, deliveryLabel, langLabel, accessLabel, resTitle, resSummary, resBody, fmtSize, fileKind, ACCESS_MSG } from '../../../lib/portal/resources';
import type { Resource, ResourceFile, AccessState } from '../../../lib/portal/resources';
import { SECTORS_FALLBACK, skillName, domainLabel, domainTone, skillLevelLabel, frameworkBadges, sectorName } from '../../../lib/portal/skills';
import type { Skill, Sector } from '../../../lib/portal/skills';

export default function ResourcePage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }

const RESUME_KEY = 'athar_resume';
const KIND_ICON: Record<string, IconName> = { pdf: 'doc', doc: 'doc', slides: 'slides', sheet: 'table', video: 'play', image: 'folder', zip: 'folder', file: 'doc' };

function Inner() {
  const { lang } = useLang(); const params = useParams<{ id: string }>(); const id = String(params?.id || ''); const db = useMemo(() => supabase(), []);
  const [r, setR] = useState<Resource | null>(null); const [files, setFiles] = useState<ResourceFile[]>([]); const [skills, setSkills] = useState<Skill[]>([]); const [sectors, setSectors] = useState<Sector[]>(SECTORS_FALLBACK);
  const [related, setRelated] = useState<Resource[]>([]); const [program, setProgram] = useState<{ id: string; name_ar: string; name_en?: string | null } | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null); const [state, setState] = useState<AccessState | null>(null);
  const [loaded, setLoaded] = useState(false); const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(''); const [err, setErr] = useState('');

  async function token(): Promise<string> { const { data } = await db.auth.getSession(); return data.session?.access_token || ''; }

  useEffect(() => {
    (async () => {
      try {
        const [{ data }, { data: fs }, { data: { user: u } }] = await Promise.all([
          db.from('portal_resources').select('*').eq('id', id).maybeSingle(),
          db.from('portal_resource_files').select('id,resource_id,name,size,mime,version,sort,downloads,created_at,path').eq('resource_id', id).order('sort'),
          db.auth.getUser(),
        ]);
        const res = (data as Resource) || null; setR(res); setFiles(((fs || []) as ResourceFile[]).map(f => ({ ...f, path: '' })));
        if (u) { setUser({ id: u.id, email: u.email || '' }); try { localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ } }
        if (res) {
          const ids = res.skills || [];
          const [{ data: sk }, { data: sec }, { data: rel }, { data: pg }] = await Promise.all([
            ids.length ? db.from('portal_skills').select('*').in('id', ids) : Promise.resolve({ data: [] as any[] }),
            db.from('portal_sectors').select('*').eq('active', true).order('sort'),
            db.from('portal_resources').select('*').eq('status', 'published').neq('id', id).limit(24),
            res.program_id ? db.from('programs').select('id,name_ar,name_en').eq('id', res.program_id).maybeSingle() : Promise.resolve({ data: null as any }),
          ]);
          setSkills((sk || []) as Skill[]); if (sec && (sec as any[]).length) setSectors(sec as Sector[]); setProgram(pg || null);
          const all = (rel || []) as Resource[];
          setRelated(all.filter(x => x.sector === res.sector || x.type === res.type || (x.skills || []).some(s => ids.includes(s))).slice(0, 3));
          const tk = await token();
          const st = await fetch(`/api/resources?resource_id=${id}`, { headers: tk ? { Authorization: `Bearer ${tk}` } : {} }).then(x => x.json()).catch(() => null);
          setState((st?.state as AccessState) || (res.access === 'public' ? 'ok' : 'login'));
          try {
            const key = `athar_viewed_${id}`;
            if (!sessionStorage.getItem(key)) { sessionStorage.setItem(key, '1'); fetch('/api/resources', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }, body: JSON.stringify({ action: 'view', resource_id: id }) }).catch(() => null); }
          } catch { /* ignore */ }
        }
      } catch { /* يبقى فارغًا */ }
      setLoaded(true);
    })();
  }, [db, id]);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault(); setErr(''); const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr(lang === 'ar' ? 'البريد الإلكتروني غير صالح' : 'Invalid email'); return; }
    setBusy('link');
    try { localStorage.setItem(RESUME_KEY, `/resources/${id}`); } catch { /* ignore */ }
    const { error } = await db.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/resources/${id}` } });
    setBusy('');
    if (error) setErr((lang === 'ar' ? 'تعذّر إرسال الرابط: ' : 'Could not send link: ') + error.message); else setSent(true);
  }

  async function download(f: ResourceFile) {
    setErr(''); setBusy(f.id);
    try {
      const tk = await token();
      const res = await fetch('/api/resources', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }, body: JSON.stringify({ action: 'download', resource_id: id, file_id: f.id }) });
      const j = await res.json();
      if (!j.success) { if (j.state) setState(j.state as AccessState); setErr(j.error || (lang === 'ar' ? 'تعذّر التنزيل' : 'Download failed')); }
      else { setFiles(x => x.map(y => y.id === f.id ? { ...y, downloads: (y.downloads || 0) + 1 } : y)); setR(x => x ? { ...x, downloads: (x.downloads || 0) + 1 } : x); const a = document.createElement('a'); a.href = j.url; a.download = j.name || f.name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
    } catch (e: any) { setErr(String(e?.message || e)); }
    setBusy('');
  }

  if (loaded && !r) return <main className="pt-main"><section className="pt-sec"><div className="pt-wrap" style={{ textAlign: 'center' }}><h2>{lang === 'ar' ? 'المادة غير موجودة أو غير منشورة' : 'Resource not found or unpublished'}</h2><Link href="/resources" className="pt-btn">{lang === 'ar' ? 'العودة إلى المستودع' : 'Back to repository'}</Link></div></section></main>;
  if (!r) return <main className="pt-main"><section className="pt-sec"><div className="pt-wrap pt-empty">…</div></section></main>;

  const body = resBody(r, lang); const canDl = state === 'ok'; const gate = state && state !== 'ok' && state !== 'not_found' ? state : null;
  return (
    <main className="pt-main rd">
      <section className="pt-pagehead"><div className="pt-wrap">
        <div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link> / <Link href="/resources">{lang === 'ar' ? 'مستودع الحقائب' : 'Resources'}</Link> / <span>{typeLabel(r.type, lang)}</span></div>
        <div className="rd-head">
          <span className={`pt-ic ${r.type === 'package' ? 'gold' : 'teal'}`}><Icon name={typeIcon(r.type) as IconName} size={24} /></span>
          <div><h1>{resTitle(r, lang)}</h1>{resSummary(r, lang) && <p>{resSummary(r, lang)}</p>}
            <div className="rd-meta"><span><Icon name="folder" size={13} /> {typeLabel(r.type, lang)}</span><span><Icon name="trend" size={13} /> {levelLabel(r.level, lang)}</span><span><Icon name="laptop" size={13} /> {deliveryLabel(r.delivery, lang)}</span><span><Icon name="globe" size={13} /> {langLabel(r.lang, lang)}</span>{r.sector && <span><Icon name="flag" size={13} /> {sectorName(r.sector, sectors, lang)}</span>}<span className={`rd-access ${r.access}`}><Icon name={r.access === 'public' ? 'globe' : 'shield'} size={13} /> {accessLabel(r.access, lang)}</span>{r.ai_ready && <span className="rd-ai">AI-ready</span>}</div>
          </div>
        </div>
      </div></section>

      <section className="pt-sec"><div className="pt-wrap pt-two">
        <div style={{ display: 'grid', gap: 14 }}>
          {body.length > 0 && <div className="pt-box pt-prose"><h3><Icon name="book" size={18} /> {lang === 'ar' ? 'عن هذه المادة' : 'About this resource'}</h3>{body.map((p, i) => <p key={i}>{p}</p>)}</div>}
          {skills.length > 0 && <div className="pt-box"><h3><Icon name="target" size={18} /> {lang === 'ar' ? 'المهارات التي تنمّيها' : 'Skills developed'}</h3>
            <div className="rd-skills">{skills.map(s => <div key={s.id} className="rd-skill"><span className={`rd-dot ${domainTone(s.domain)}`} /><div><b>{skillName(s, lang)}</b><small>{s.code} · {domainLabel(s.domain, lang)} · {skillLevelLabel(s.level, lang)}</small></div><div className="rd-fw">{frameworkBadges(s).map(b => <span key={b.k} className={b.k}>{b.label}</span>)}</div></div>)}</div>
            <p className="pt-muted" style={{ marginTop: 10, fontSize: 12.5 }}>{lang === 'ar' ? 'الرموز المرجعية: SAQF الإطار السعودي للمؤهلات · SDAIA إطار مهارات البيانات والذكاء الاصطناعي · CEFR الإطار الأوروبي المرجعي للغات.' : 'Reference codes: SAQF (Saudi Qualifications Framework) · SDAIA data & AI skills framework · CEFR (languages).'}</p></div>}
          {program && <div className="pt-box"><h3><Icon name="programs" size={18} /> {lang === 'ar' ? 'البرنامج المرتبط' : 'Linked program'}</h3><p style={{ margin: 0 }}><Link href={`/programs/${program.id}`} className="pt-btn light small">{programName(program as any, lang)} <Icon name="arrow" size={13} /></Link></p></div>}
          {r.tags && r.tags.length > 0 && <div className="pt-chips">{r.tags.map(x => <Link key={x} href={`/resources?q=${encodeURIComponent(x)}`} className="pt-chip">#{x}</Link>)}</div>}
        </div>

        <aside className="pt-box pt-sticky rd-aside">
          <h3><Icon name="download" size={18} /> {lang === 'ar' ? 'الملفات' : 'Files'} <small>({files.length})</small></h3>
          {files.length === 0 && <p className="pt-muted">{lang === 'ar' ? 'لا ملفات مرفوعة بعد.' : 'No files uploaded yet.'}</p>}
          <div className="rd-files">{files.map(f => <div key={f.id} className="rd-file"><Icon name={KIND_ICON[fileKind(f.name, f.mime)]} size={20} /><div><b>{f.name}</b><small><bdi>{fmtSize(f.size, lang)}</bdi> · v<bdi>{f.version}</bdi> · <bdi>{f.downloads || 0}</bdi> {lang === 'ar' ? 'تنزيل' : 'downloads'}</small></div>
            <button type="button" className={`pt-btn small ${canDl ? '' : 'ghost'}`} disabled={!!busy || state === null} onClick={() => canDl ? download(f) : document.getElementById('gate')?.scrollIntoView({ behavior: 'smooth' })} title={canDl ? '' : accessLabel(r.access, lang)}><Icon name={canDl ? 'download' : 'shield'} size={14} /> {busy === f.id ? '…' : canDl ? (lang === 'ar' ? 'تنزيل' : 'Download') : (lang === 'ar' ? 'مقيّد' : 'Locked')}</button></div>)}</div>
          {err && <div className="pt-alert err" style={{ marginTop: 10 }}>{err}</div>}
          {gate && <div id="gate" className={`rd-gate ${gate}`}>
            <b><Icon name="shield" size={15} /> {accessLabel(r.access, lang)}</b>
            <p>{t(ACCESS_MSG[gate], lang)}</p>
            {gate === 'login' && !sent && <form onSubmit={sendLink} className="pt-form"><label>{lang === 'ar' ? 'بريدك الإلكتروني' : 'Your email'}<input dir="ltr" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" required /></label><button className="pt-btn" disabled={busy === 'link'}><Icon name="mail" size={15} /> {busy === 'link' ? '…' : (lang === 'ar' ? 'أرسل رابط الدخول' : 'Send sign-in link')}</button></form>}
            {gate === 'login' && sent && <div className="pt-alert ok">{lang === 'ar' ? `أرسلنا رابط الدخول إلى ${email}. افتحه من الجهاز نفسه لتعود إلى هذه الصفحة وتحمّل مباشرة.` : `We sent a sign-in link to ${email}. Open it on this device to return here and download.`}</div>}
            {gate === 'program' && r.program_id && <Link href={`/programs/${r.program_id}?register=1`} className="pt-btn gold small"><Icon name="programs" size={14} /> {lang === 'ar' ? 'التسجيل في البرنامج' : 'Enrol in the program'}</Link>}
            {gate === 'org' && <Link href="/contact?subject=resources" className="pt-btn light small"><Icon name="chat" size={14} /> {t(UI.contactUs, lang)}</Link>}
            {user && <small className="pt-muted" style={{ display: 'block', marginTop: 8 }}>{lang === 'ar' ? 'مسجّل الدخول بـ' : 'Signed in as'} <bdi>{user.email}</bdi></small>}
          </div>}
          <div className="rd-facts"><span><small>{lang === 'ar' ? 'الإصدار' : 'Version'}</small><b><bdi>{r.version}</bdi></b></span><span><small>{lang === 'ar' ? 'النشر' : 'Published'}</small><b><bdi>{fmtDate(r.published_at, lang)}</bdi></b></span><span><small>{lang === 'ar' ? 'التنزيلات' : 'Downloads'}</small><b><bdi>{r.downloads || 0}</bdi></b></span></div>
        </aside>
      </div></section>

      {related.length > 0 && <section className="pt-sec soft"><div className="pt-wrap">
        <div className="pt-sechead"><h2>{lang === 'ar' ? 'مواد ذات صلة' : 'Related resources'}</h2></div>
        <div className="pt-grid three">{related.map(x => <Link key={x.id} href={`/resources/${x.id}`} className="pt-card"><span className="pt-ic teal"><Icon name={typeIcon(x.type) as IconName} size={20} /></span><small className="pt-muted">{typeLabel(x.type, lang)} · {levelLabel(x.level, lang)}</small><h3>{resTitle(x, lang)}</h3><span className="pt-tag">{accessLabel(x.access, lang)}</span></Link>)}</div>
      </div></section>}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

const CSS = `
.rd-head{display:flex;gap:18px;align-items:flex-start}.rd-head h1{margin:0 0 8px}.rd-head p{margin:0 0 10px;max-width:760px}
.rd-meta{display:flex;gap:8px;flex-wrap:wrap;font-size:12.5px}.rd-meta span{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.12);color:#fff;border-radius:999px;padding:4px 10px;font-weight:700}
.rd-access.public{background:#047857!important}.rd-access.registered{background:#1d4ed8!important}.rd-access.program{background:#c2410c!important}.rd-access.org{background:#6d28d9!important}.rd-access.staff{background:#334155!important}.rd-ai{background:#c9a24b!important;color:#1f2937!important}
.rd-skills{display:grid;gap:10px}.rd-skill{display:grid;grid-template-columns:10px 1fr auto;gap:12px;align-items:center;padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}.rd-skill b{display:block;font-size:14px;color:#0f172a}.rd-skill small{color:#64748b;font-size:12px}
.rd-dot{width:10px;height:10px;border-radius:50%;background:#0f2a4e}.rd-dot.teal{background:#0b8a83}.rd-dot.gold{background:#c9a24b}.rd-dot.ok{background:#047857}.rd-dot.violet{background:#6d28d9}.rd-dot.sky{background:#0284c7}.rd-dot.warn{background:#d97706}.rd-dot.rose{background:#be123c}
.rd-fw{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.rd-fw span{font-size:10.5px;font-weight:900;border-radius:6px;padding:3px 7px;background:#e2e8f0;color:#334155;letter-spacing:.3px;direction:ltr}.rd-fw .saqf{background:#dcfce7;color:#166534}.rd-fw .sdaia{background:#ede9fe;color:#5b21b6}.rd-fw .cefr{background:#dbeafe;color:#1e40af}
.rd-aside h3 small{color:#64748b;font-weight:600}.rd-files{display:grid;gap:8px}.rd-file{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:10px;border:1px solid #e2e8f0;border-radius:12px;color:#0f2a4e}.rd-file b{display:block;font-size:13.5px;color:#0f172a;word-break:break-all}.rd-file small{color:#64748b;font-size:11.5px}
.rd-gate{margin-top:14px;padding:14px;border-radius:14px;background:#fff7ed;border:1px solid #fed7aa}.rd-gate.login{background:#eff6ff;border-color:#bfdbfe}.rd-gate.org{background:#f5f3ff;border-color:#ddd6fe}.rd-gate.staff{background:#f1f5f9;border-color:#e2e8f0}.rd-gate b{display:flex;gap:6px;align-items:center;color:#0f172a;margin-bottom:6px}.rd-gate p{margin:0 0 10px;font-size:13.5px;color:#334155;line-height:1.8}.rd-gate .pt-form{gap:8px}
.rd-facts{margin-top:14px;padding-top:12px;border-top:1px dashed #e2e8f0;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center}.rd-facts small{display:block;color:#64748b;font-size:11.5px}.rd-facts b{color:#0f172a;font-size:14px}
@media(max-width:760px){.rd-head{flex-direction:column}.rd-skill{grid-template-columns:10px 1fr}.rd-fw{grid-column:2;justify-content:flex-start}}
`;
