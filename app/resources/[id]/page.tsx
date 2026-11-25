'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — صفحة الحقيبة: التفاصيل، المهارات (مع الأطر المرجعية)، الملفات والتنزيل الآمن، بوّابة الوصول بالبريد
// P5-ب: وضع المعاينة للحقائب المرخَّصة — الزائر يرى الاسم والنواتج وقائمة الملفّات فقط؛ لا رابط ملفّ قبل 'ok'؛ شراء بفاتورة → /pay؛
//     رادعات على الصفحة (منع التحديد/النسخ/القصّ/القائمة اليمنى/الطباعة/اختصارات الحفظ، وتعتيم عند الخروج من النافذة أو PrintScreen).

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import type { IconName } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { UI, t, fmtDate, programName } from '../../../lib/portal/content';
import { typeLabel, typeIcon, levelLabel, deliveryLabel, langLabel, accessLabel, resTitle, resSummary, resBody, fmtSize, fileKind, ACCESS_MSG, priceLabel, priceNum, fileExhausted } from '../../../lib/portal/resources';
import type { GrantInfo } from '../../../lib/portal/resources';
import type { Resource, ResourceFile, AccessState } from '../../../lib/portal/resources';
import { SECTORS_FALLBACK, skillName, domainLabel, domainTone, skillLevelLabel, frameworkBadges, sectorName } from '../../../lib/portal/skills';
import type { Skill, Sector } from '../../../lib/portal/skills';

export default function ResourcePage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }

const RESUME_KEY = 'athar_resume';
const KIND_ICON: Record<string, IconName> = { pdf: 'doc', doc: 'doc', slides: 'slides', sheet: 'table', video: 'play', image: 'folder', zip: 'folder', file: 'doc' };

function Inner() {
  const { lang } = useLang(); const params = useParams<{ id: string }>(); const router = useRouter(); const id = String(params?.id || ''); const db = useMemo(() => supabase(), []);
  const [r, setR] = useState<Resource | null>(null); const [files, setFiles] = useState<ResourceFile[]>([]); const [skills, setSkills] = useState<Skill[]>([]); const [sectors, setSectors] = useState<Sector[]>(SECTORS_FALLBACK);
  const [related, setRelated] = useState<Resource[]>([]); const [program, setProgram] = useState<{ id: string; name_ar: string; name_en?: string | null } | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null); const [state, setState] = useState<AccessState | null>(null); const [grant, setGrant] = useState<GrantInfo | null>(null); const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false); const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [pendingInv, setPendingInv] = useState<string | null>(null); const [veil, setVeil] = useState(false);

  async function token(): Promise<string> { const { data } = await db.auth.getSession(); return data.session?.access_token || ''; }

  useEffect(() => {
    (async () => {
      try {
        const [{ data }, { data: fs }, { data: { user: u } }] = await Promise.all([
          db.from('portal_resources').select('*').eq('id', id).maybeSingle(),
          db.from('portal_resource_files').select('id,resource_id,name,size,mime,version,sort,downloads,created_at').eq('resource_id', id).order('sort'),
          db.auth.getUser(),
        ]);
        const res = (data as Resource) || null; setR(res); setFiles(((fs || []) as any[]).map(f => ({ ...f, path: '' }) as ResourceFile));
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
          setState((st?.state as AccessState) || (res.access === 'public' ? 'ok' : 'login')); setPendingInv(st?.pending_invoice_id || null); setGrant((st?.grant as GrantInfo) || null);
          try {
            const key = `athar_viewed_${id}`;
            if (!sessionStorage.getItem(key)) { sessionStorage.setItem(key, '1'); fetch('/api/resources', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }, body: JSON.stringify({ action: 'view', resource_id: id }) }).catch(() => null); }
          } catch { /* ignore */ }
        }
      } catch { /* يبقى فارغًا */ }
      setLoaded(true);
    })();
  }, [db, id]);

  /* P5-ب — رادعات وضع المعاينة (تعمل فقط عندما لا يكون الوصول 'ok'). التصوير لا يُمنع تقنيًّا في المتصفّح؛ نُعتّم الصفحة عند مغادرتها أو عند PrintScreen ونُفرغ الحافظة. */
  const locked = state !== null && state !== 'ok';
  useEffect(() => {
    if (!locked) return;
    const stop = (e: Event) => { e.preventDefault(); };
    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(); const mod = e.ctrlKey || e.metaKey;
      if (k === 'printscreen') { setVeil(true); try { navigator.clipboard?.writeText(''); } catch { /* ignore */ } setTimeout(() => setVeil(false), 1800); e.preventDefault(); return; }
      if (mod && ['p', 's', 'c', 'x', 'a', 'u'].includes(k)) { e.preventDefault(); e.stopPropagation(); }
      if (mod && e.shiftKey && ['i', 'j', 'c', 's'].includes(k)) { e.preventDefault(); }
    };
    const hide = () => setVeil(document.visibilityState !== 'visible'); const blur = () => setVeil(true); const focus = () => setVeil(false);
    const bp = (e: Event) => { e.preventDefault(); };
    document.addEventListener('contextmenu', stop); document.addEventListener('copy', stop); document.addEventListener('cut', stop); document.addEventListener('dragstart', stop); document.addEventListener('selectstart', stop);
    document.addEventListener('keydown', key, true); document.addEventListener('keyup', key, true); document.addEventListener('visibilitychange', hide); window.addEventListener('blur', blur); window.addEventListener('focus', focus); window.addEventListener('beforeprint', bp);
    return () => { document.removeEventListener('contextmenu', stop); document.removeEventListener('copy', stop); document.removeEventListener('cut', stop); document.removeEventListener('dragstart', stop); document.removeEventListener('selectstart', stop); document.removeEventListener('keydown', key, true); document.removeEventListener('keyup', key, true); document.removeEventListener('visibilitychange', hide); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); window.removeEventListener('beforeprint', bp); };
  }, [locked]);

  async function buy() {
    setErr(''); setBusy('buy');
    try {
      const tk = await token(); if (!tk) { setState('login'); setBusy(''); document.getElementById('gate')?.scrollIntoView({ behavior: 'smooth' }); return; }
      const res = await fetch('/api/resources', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ action: 'buy', resource_id: id }) });
      const j = await res.json();
      if (!j.success) { if (j.state) setState(j.state as AccessState); setErr(j.error || (lang === 'ar' ? 'تعذّر إنشاء الفاتورة' : 'Could not create invoice')); }
      else { setPendingInv(j.invoice_id); router.push(j.pay_url || `/pay/${j.invoice_id}`); }
    } catch (e: any) { setErr(String(e?.message || e)); }
    setBusy('');
  }

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
      if (!j.success) { if (j.state) setState(j.state as AccessState); if (j.exhausted && grant) setGrant({ ...grant, downloads: { ...grant.downloads, [f.id]: grant.download_limit } }); setErr(j.error || (lang === 'ar' ? 'تعذّر التنزيل' : 'Download failed')); }
      else { if (grant) setGrant({ ...grant, downloads: { ...grant.downloads, [f.id]: Number(grant.downloads?.[f.id] || 0) + 1 } }); setFiles(x => x.map(y => y.id === f.id ? { ...y, downloads: (y.downloads || 0) + 1 } : y)); setR(x => x ? { ...x, downloads: (x.downloads || 0) + 1 } : x); const a = document.createElement('a'); a.href = j.url; a.download = j.name || f.name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
    } catch (e: any) { setErr(String(e?.message || e)); }
    setBusy('');
  }

  /* P5-ب: إعادة إرسال ملفّات الحقيبة إلى بريد صاحب الترخيص */
  async function resend() {
    setErr(''); setNote(''); setBusy('resend');
    try {
      const tk = await token(); if (!tk) { setState('login'); setBusy(''); return; }
      const res = await fetch('/api/resources', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ action: 'deliver', resource_id: id }) });
      const j = await res.json();
      if (!j.success) setErr(j.error || (lang === 'ar' ? 'تعذّر الإرسال' : 'Could not send'));
      else { setNote(lang === 'ar' ? `أُرسلت ملفّات الحقيبة (${j.files}) إلى ${j.email}.` : `Kit files (${j.files}) sent to ${j.email}.`); if (grant) setGrant({ ...grant, delivered_at: new Date().toISOString() }); }
    } catch (e: any) { setErr(String(e?.message || e)); }
    setBusy('');
  }

  if (loaded && !r) return <main className="pt-main"><section className="pt-sec"><div className="pt-wrap" style={{ textAlign: 'center' }}><h2>{lang === 'ar' ? 'المادة غير موجودة أو غير منشورة' : 'Resource not found or unpublished'}</h2><Link href="/resources" className="pt-btn">{lang === 'ar' ? 'العودة إلى المستودع' : 'Back to repository'}</Link></div></section></main>;
  if (!r) return <main className="pt-main"><section className="pt-sec"><div className="pt-wrap pt-empty">…</div></section></main>;

  const body = resBody(r, lang); const canDl = state === 'ok'; const gate = state && state !== 'ok' && state !== 'not_found' ? state : null;
  const paid = r.access === 'paid'; const price = priceNum(r.price_sar); const showBuy = paid && (gate === 'purchase' || gate === 'login');
  return (
    <main className={`pt-main rd ${locked ? 'rd-locked' : ''}`}>
      {locked && veil && <div className="rd-veil" aria-hidden><span>{lang === 'ar' ? 'معاينة محميّة — أَثَر' : 'Protected preview — Athar'}</span></div>}
      <section className="pt-pagehead"><div className="pt-wrap">
        <div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسة' : 'Home'}</Link> / <Link href="/resources">{lang === 'ar' ? 'مستودع الحقائب' : 'Resources'}</Link> / <span>{typeLabel(r.type, lang)}</span></div>
        <div className="rd-head">
          <span className={`pt-ic ${r.type === 'package' ? 'gold' : 'teal'}`}><Icon name={typeIcon(r.type) as IconName} size={24} /></span>
          <div><h1>{resTitle(r, lang)}</h1>{resSummary(r, lang) && <p>{resSummary(r, lang)}</p>}
            <div className="rd-meta"><span><Icon name="folder" size={13} /> {typeLabel(r.type, lang)}</span><span><Icon name="trend" size={13} /> {levelLabel(r.level, lang)}</span><span><Icon name="laptop" size={13} /> {deliveryLabel(r.delivery, lang)}</span><span><Icon name="globe" size={13} /> {langLabel(r.lang, lang)}</span>{r.sector && <span><Icon name="flag" size={13} /> {sectorName(r.sector, sectors, lang)}</span>}<span className={`rd-access ${r.access}`}><Icon name={r.access === 'public' ? 'globe' : 'shield'} size={13} /> {accessLabel(r.access, lang)}{paid && price > 0 && <> · <bdi>{priceLabel(price, lang)}</bdi></>}</span>{r.ai_ready && <span className="rd-ai">AI-ready</span>}</div>
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
          <h3><Icon name={canDl ? 'download' : 'shield'} size={18} /> {lang === 'ar' ? (canDl ? 'الملفات' : 'محتويات الحقيبة') : (canDl ? 'Files' : 'Kit contents')} <small>({files.length})</small></h3>
          {files.length === 0 && <p className="pt-muted">{lang === 'ar' ? 'لا ملفات مرفوعة بعد.' : 'No files uploaded yet.'}</p>}
          {locked && files.length > 0 && <p className="rd-prev-note"><Icon name="shield" size={13} /> {lang === 'ar' ? 'معاينة: الأسماء والأحجام فقط — لا فتح ولا تنزيل ولا نسخ قبل الترخيص.' : 'Preview: names and sizes only — no opening, download or copying before licensing.'}</p>}
          <div className={`rd-files ${locked ? 'rd-wm' : ''}`}>{files.map((f, i) => <div key={f.id} className={`rd-file ${locked ? 'locked' : ''}`}><Icon name={KIND_ICON[fileKind(f.name, f.mime)]} size={20} /><div><b>{locked ? <span className="rd-n">{i + 1}</span> : null}{f.name}</b><small><bdi>{fmtSize(f.size, lang)}</bdi> · v<bdi>{f.version}</bdi>{canDl && <> · <bdi>{f.downloads || 0}</bdi> {lang === 'ar' ? 'تنزيل' : 'downloads'}</>}</small></div>
            {canDl ? (fileExhausted(grant, f.id) ? <span className="rd-lock" title={lang === 'ar' ? 'نُزِّل من الموقع — الملفّ في بريدك' : 'Downloaded — the file is in your email'}><Icon name="check" size={13} /> {lang === 'ar' ? 'في بريدك' : 'In your email'}</span> : <button type="button" className="pt-btn small" disabled={!!busy} onClick={() => download(f)}><Icon name="download" size={14} /> {busy === f.id ? '…' : (lang === 'ar' ? 'تنزيل' : 'Download')}</button>)
              : <span className="rd-lock" title={accessLabel(r.access, lang)} onClick={() => document.getElementById('gate')?.scrollIntoView({ behavior: 'smooth' })}><Icon name="shield" size={13} /> {state === null ? '…' : (lang === 'ar' ? 'بعد الترخيص' : 'Licence')}</span>}</div>)}</div>
          {canDl && r.access === 'paid' && grant && <div className="rd-deliv"><Icon name="mail" size={14} /> <span>{lang === 'ar' ? <>ترخيصك باسم <bdi dir="ltr">{grant.email}</bdi> — {grant.delivered_at ? 'أُرسلت الملفّات إلى بريدك' : 'تُرسل الملفّات إلى بريدك عند التفعيل'}؛ والتنزيل من الموقع مرّة واحدة لكلّ ملفّ.</> : <>Licensed to <bdi dir="ltr">{grant.email}</bdi> — {grant.delivered_at ? 'files were emailed to you' : 'files are emailed on activation'}; on-site download is once per file.</>}</span><button type="button" className="pt-btn small" disabled={!!busy} onClick={resend}><Icon name="mail" size={13} /> {busy === 'resend' ? '…' : (lang === 'ar' ? 'أعد إرسال الملفّات إلى بريدي' : 'Resend files to my email')}</button></div>}
          {note && <div className="pt-alert ok" style={{ marginTop: 10 }}>{note}</div>}
          {err && <div className="pt-alert err" style={{ marginTop: 10 }}>{err}</div>}
          {gate && <div id="gate" className={`rd-gate ${gate}`}>
            <b><Icon name="shield" size={15} /> {accessLabel(r.access, lang)}</b>
            <p>{t(ACCESS_MSG[showBuy ? 'purchase' : gate], lang)}</p>
            {showBuy && <div className="rd-price"><div><small>{lang === 'ar' ? 'ترخيص استخدام شخصيّ' : 'Personal use licence'}</small><b><bdi>{priceLabel(price, lang)}</bdi></b><small>{lang === 'ar' ? 'قبل ضريبة القيمة المضافة · فاتورة ضريبية · تحويل بنكي أو بطاقة' : 'Before VAT · tax invoice · bank transfer or card'}</small></div>
              {gate === 'purchase' && (pendingInv
                ? <Link href={`/pay/${pendingInv}`} className="pt-btn gold small"><Icon name="arrow" size={14} /> {lang === 'ar' ? 'أكمل سداد الفاتورة' : 'Complete payment'}</Link>
                : <button type="button" className="pt-btn gold small" disabled={busy === 'buy' || !(price > 0)} onClick={buy}><Icon name="check" size={14} /> {busy === 'buy' ? '…' : (lang === 'ar' ? 'اشترِ الترخيص' : 'Buy licence')}</button>)}
              {gate === 'login' && <small className="pt-muted">{lang === 'ar' ? 'سجّل الدخول ببريدك أوّلًا ثمّ يظهر زرّ الشراء.' : 'Sign in with your email first; the buy button then appears.'}</small>}
            </div>}
            {showBuy && <p className="rd-fine">{lang === 'ar' ? 'يُفتح التنزيل تلقائيًّا بعد تأكيد السداد. كلّ تنزيل يُسجَّل باسم صاحب الترخيص وبريده؛ الملفّات محميّة بحقوق المؤلّف © ولا يجوز نقلها أو إعادة نشرها.' : 'Downloads unlock automatically once payment is confirmed. Every download is logged to the licence holder; files are © protected and may not be shared or republished.'}</p>}
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
.rd-access.public{background:#2F6B66!important}.rd-access.registered{background:#6A3350!important}.rd-access.program{background:#8A5A1E!important}.rd-access.org{background:#8E4A68!important}.rd-access.staff{background:#4A3645!important}.rd-ai{background:#D9A866!important;color:#2A1626!important}
.rd-skills{display:grid;gap:10px}.rd-skill{display:grid;grid-template-columns:10px 1fr auto;gap:12px;align-items:center;padding:10px 12px;border:1px solid #EADFD6;border-radius:12px;background:#FBF4EE}.rd-skill b{display:block;font-size:14px;color:#2A1626}.rd-skill small{color:#8E7F8A;font-size:12px}
.rd-dot{width:10px;height:10px;border-radius:50%;background:#3A1F36}.rd-dot.teal{background:#D4614A}.rd-dot.gold{background:#D9A866}.rd-dot.ok{background:#2F6B66}.rd-dot.violet{background:#8E4A68}.rd-dot.sky{background:#3F7F79}.rd-dot.warn{background:#8A5A1E}.rd-dot.rose{background:#B9544A}
.rd-fw{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.rd-fw span{font-size:10.5px;font-weight:900;border-radius:6px;padding:3px 7px;background:#EADFD6;color:#4A3645;letter-spacing:.3px;direction:ltr}.rd-fw .saqf{background:#E6F3F1;color:#2F6B66}.rd-fw .sdaia{background:#F3E8EF;color:#6A3350}.rd-fw .cefr{background:#F3E8EF;color:#6A3350}
.rd-aside h3 small{color:#8E7F8A;font-weight:600}.rd-files{display:grid;gap:8px}.rd-file{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:10px;border:1px solid #EADFD6;border-radius:12px;color:#3A1F36}.rd-file b{display:block;font-size:13.5px;color:#2A1626;word-break:break-all}.rd-file small{color:#8E7F8A;font-size:11.5px}
.rd-gate{margin-top:14px;padding:14px;border-radius:14px;background:#FBF4EE;border:1px solid #F1D9A8}.rd-gate.login{background:#F3E8EF;border-color:#E2CBDA}.rd-gate.org{background:#F3E8EF;border-color:#F3E8EF}.rd-gate.staff{background:#F6EBE0;border-color:#EADFD6}.rd-gate b{display:flex;gap:6px;align-items:center;color:#2A1626;margin-bottom:6px}.rd-gate p{margin:0 0 10px;font-size:13.5px;color:#4A3645;line-height:1.8}.rd-gate .pt-form{gap:8px}
.rd-facts{margin-top:14px;padding-top:12px;border-top:1px dashed #EADFD6;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center}.rd-facts small{display:block;color:#8E7F8A;font-size:11.5px}.rd-facts b{color:#2A1626;font-size:14px}
.rd-access.paid{background:#8A5A1E!important}
.rd-locked,.rd-locked *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}.rd-locked img,.rd-locked a{-webkit-user-drag:none}
.rd-veil{position:fixed;inset:0;z-index:9999;background:rgba(58,31,54,.96);display:grid;place-items:center;color:#D9A866;font-weight:900;font-size:22px;letter-spacing:.5px;backdrop-filter:blur(14px)}
.rd-deliv{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px;padding:10px 12px;border-radius:12px;background:#FBF4EE;border:1px solid #F1D9A8;font-size:13px;line-height:1.7;color:#4A2E45}.rd-deliv span{flex:1;min-width:220px}
.rd-prev-note{display:flex;gap:6px;align-items:center;margin:0 0 10px;font-size:12.5px;color:#8A5A1E;background:#FBF4EE;border:1px dashed #F1D9A8;border-radius:10px;padding:7px 10px}
.rd-wm{position:relative;overflow:hidden}.rd-wm::after{content:'أَثَر · معاينة محميّة · © 2026';position:absolute;inset:-40% -20%;pointer-events:none;color:rgba(58,31,54,.06);font-size:28px;font-weight:900;line-height:2.6;transform:rotate(-24deg);white-space:pre-wrap;text-align:center;word-spacing:30px}
.rd-file.locked{background:#FBF4EE;border-style:dashed;color:#8E7F8A}.rd-file.locked b{color:#4A3645}.rd-n{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:6px;background:#3A1F36;color:#D9A866;font-size:11px;margin-inline-end:6px;vertical-align:middle}
.rd-lock{display:inline-flex;gap:4px;align-items:center;font-size:11.5px;font-weight:900;color:#8A5A1E;background:#F6EBE0;border-radius:999px;padding:5px 9px;cursor:pointer;white-space:nowrap}
.rd-gate.purchase{background:#FBF4EE;border-color:#D9A866}.rd-price{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:#fff;border:1px solid #EADFD6;border-radius:12px;padding:10px 12px;margin:4px 0 8px}.rd-price>div{display:grid;gap:2px}.rd-price small{font-size:11.5px;color:#8E7F8A}.rd-price b{font-size:22px;color:#3A1F36}
.rd-fine{font-size:12px!important;color:#8E7F8A!important;line-height:1.7!important}
@media print{.rd-locked .pt-main,.rd-locked{display:none!important}body:has(.rd-locked)::before{content:'هذه الصفحة معاينة محميّة من أَثَر — الطباعة غير متاحة قبل الترخيص.';display:block;padding:40px;font-size:18px;font-weight:900}}
@media(max-width:760px){.rd-head{flex-direction:column}.rd-skill{grid-template-columns:10px 1fr}.rd-fw{grid-column:2;justify-content:flex-start}}
`;
