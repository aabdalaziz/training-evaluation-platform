'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * هيئة أَثَر (P31) — الوجه العام: قائمة بحث (DirectoryList) وصفحة عضو (DirectoryProfile).
 *  «سيرتك توثّقها بنفسك، وشهادة توثيقها أَثَر». لا نجوم ولا ترتيب تفضيلي ولا «مميّز» — الترتيب: آخر تحديث ثم الاسم.
 *  لا بريد ولا هاتف لأحد: الطلب يصل إلى أَثَر وأَثَر ينسّق. «ما شهده أَثَر» مشتق من السجلات ولا يُكتب باليد.
 *  WCAG 2.2 AA: نموذج بحث بعناوين مرئية · نتائج تُعلَن (aria-live) · صور بنص بديل · تركيز مرئي · لا رسائل تختفي بمؤقّت · أهداف لمس ≥ 24px.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';

export type Face = 'expert' | 'trainer';
type Meta = { skills: { id: string; code: string; name_ar: string; domain: string; domain_ar?: string }[]; sectors: { code: string; name_ar: string }[]; rules: { tagline_ar: string; faces_ar: Record<string, string>; face_titles_ar: Record<string, string>; services: { code: string; name_ar: string }[]; modes: { code: string; name_ar: string }[]; languages: { code: string; name_ar: string }[]; page: number }; privacy_ar: string };
type Card = { slug: string; faces: Face[]; name_ar: string; title_ar: string; photo_url: string | null; city: string | null; skill_names: string[]; sectors: string[]; services: string[]; modes: string[]; updated_at: string; cards: { expert: { code: string } | null; trainer: { code: string } | null } };
type PubProfile = Card & { name_en: string | null; title_en: string | null; languages: string[]; coverage: string[]; summary_ar: string; achievements: string[]; education: { degree: string; field: string; institution: string; year: string }[]; experience: { role: string; organization: string; from: string; to: string; line: string }[]; certifications: { name: string; issuer: string; year: string }[]; publications: { title: string; type: string; year: string; url?: string }[]; skill_ids: string[]; approved_at: string | null; cards: { expert: { code: string; issued_at: string } | null; trainer: { code: string; issued_at: string } | null } };
export const fmtD = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium' }) : '—');
export const PATH: Record<Face, string> = { expert: 'experts', trainer: 'trainers' };
const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('');
export const nameMap = (list: { code: string; name_ar: string }[]) => Object.fromEntries(list.map(x => [x.code, x.name_ar]));

export function Avatar({ src, name, size = 72 }: { src: string | null; name: string; size?: number }) {
  return src ? <img className="dr-photo" src={src} alt={`صورة ${name}`} width={size} height={size} loading="lazy" style={{ width: size, height: size }} /> : <span className="dr-photo dr-noimg" aria-hidden="true" style={{ width: size, height: size, fontSize: size / 3 }}>{initials(name)}</span>;
}

export function DirectoryList({ face }: { face: Face }) {
  const [meta, setMeta] = useState<Meta | null>(null); const [items, setItems] = useState<Card[]>([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1); const [pages, setPages] = useState(1);
  const [q, setQ] = useState(''); const [skill, setSkill] = useState(''); const [sector, setSector] = useState(''); const [service, setService] = useState(''); const [mode, setMode] = useState(''); const [city, setCity] = useState('');
  const [busy, setBusy] = useState(true); const [err, setErr] = useState(''); const first = useRef(true);
  useEffect(() => { fetch('/api/directory?meta=1', { cache: 'no-store' }).then(r => r.json()).then(j => { if (j?.success) setMeta(j); }).catch(() => null); }, []);
  const run = useCallback(async (pg = 1, init?: Record<string, string>) => {
    setBusy(true); setErr('');
    const f = init || { q, skill, sector, service, mode, city }; const u = new URLSearchParams({ face, page: String(pg) }); for (const [k, v] of Object.entries(f)) if (v) u.set(k, v);
    try { const j = await fetch(`/api/directory?${u}`, { cache: 'no-store' }).then(r => r.json()); if (j?.success) { setItems(j.items); setTotal(j.total); setPage(j.page); setPages(j.pages); } else setErr(j?.error || 'تعذّر البحث'); } catch { setErr('انقطع الاتصال'); } finally { setBusy(false); }
    try { const url = new URL(window.location.href); url.search = ''; for (const [k, v] of Object.entries(f)) if (v) url.searchParams.set(k, v); if (pg > 1) url.searchParams.set('page', String(pg)); window.history.replaceState(null, '', url.toString()); } catch { /* لا شيء */ }
  }, [face, q, skill, sector, service, mode, city]);
  useEffect(() => { if (!first.current) return; first.current = false; let init: Record<string, string> = {}; let pg = 1; try { const sp = new URLSearchParams(window.location.search); init = { q: sp.get('q') || '', skill: sp.get('skill') || '', sector: sp.get('sector') || '', service: sp.get('service') || '', mode: sp.get('mode') || '', city: sp.get('city') || '' }; pg = Number(sp.get('page') || 1) || 1; } catch { /* لا شيء */ } setQ(init.q || ''); setSkill(init.skill || ''); setSector(init.sector || ''); setService(init.service || ''); setMode(init.mode || ''); setCity(init.city || ''); run(pg, init); }, [run]);
  const title = face === 'expert' ? 'هيئة أَثَر للخبراء' : 'هيئة أَثَر للمدربين'; const other: Face = face === 'expert' ? 'trainer' : 'expert';
  const sectorName = meta ? nameMap(meta.sectors) : {};
  return (
    <main className="dr" dir="rtl" data-testid={`dir-${face}`}><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="dr-hero">
        <span className="pt-kicker"><Icon name="users" size={14} /> هيئة أَثَر · {meta?.rules.tagline_ar || 'سيرتك توثّقها بنفسك، وشهادة توثيقها أَثَر'}</span>
        <h1>{title}</h1>
        <p>{face === 'expert' ? 'خبراء استشاريون وثّقوا سيرهم بكلماتهم، وراجعها طاقم أَثَر واعتمدها بشهادة موقَّعة. بجانب كل سيرة «ما شهده أَثَر»: ما سجّلته المنصة لهم فعلًا — لا نجوم ولا تقييمات.' : 'مدربون قدّموا في أَثَر أو انضمّوا إليه، سيرهم بكلماتهم وشهادة توثيقهم من أَثَر. ما قدّموه من برامج يظهر من سجلات المنصة نفسها — لا نجوم ولا تقييمات.'}</p>
        <nav className="dr-faces" aria-label="وجها الهيئة"><span className="dr-face on" aria-current="page">{title}</span><Link className="dr-face" href={`/${PATH[other]}`}>{other === 'expert' ? 'هيئة أَثَر للخبراء' : 'هيئة أَثَر للمدربين'}</Link><Link className="dr-face join" href="/me/directory"><Icon name="plus" size={14} /> انضمّ إلى الهيئة</Link></nav>
      </header>
      <form className="dr-search" role="search" aria-label={`البحث في ${title}`} onSubmit={e => { e.preventDefault(); run(1); }}>
        <label className="dr-lbl grow">كلمة بحث<input className="dr-in" value={q} onChange={e => setQ(e.target.value)} placeholder="اسم · مجال · قطاع · مدينة" maxLength={80} data-testid="dir-q" /></label>
        <label className="dr-lbl">مجال الخبرة<select className="dr-in" value={skill} onChange={e => setSkill(e.target.value)} data-testid="dir-skill"><option value="">الكل</option>{(meta?.skills || []).map(s => <option key={s.id} value={s.id}>{s.name_ar}</option>)}</select></label>
        <label className="dr-lbl">القطاع<select className="dr-in" value={sector} onChange={e => setSector(e.target.value)}><option value="">الكل</option>{(meta?.sectors || []).map(s => <option key={s.code} value={s.code}>{s.name_ar}</option>)}</select></label>
        <label className="dr-lbl">الخدمة<select className="dr-in" value={service} onChange={e => setService(e.target.value)}><option value="">الكل</option>{(meta?.rules.services || []).map(s => <option key={s.code} value={s.code}>{s.name_ar}</option>)}</select></label>
        <label className="dr-lbl">النمط<select className="dr-in" value={mode} onChange={e => setMode(e.target.value)}><option value="">الكل</option>{(meta?.rules.modes || []).map(s => <option key={s.code} value={s.code}>{s.name_ar}</option>)}</select></label>
        <label className="dr-lbl">المدينة<input className="dr-in" value={city} onChange={e => setCity(e.target.value)} maxLength={60} /></label>
        <div className="dr-sbtns"><button type="submit" className="pt-btn small" disabled={busy} data-testid="dir-go"><Icon name="search" size={15} /> ابحث</button><button type="button" className="pt-btn ghost small" onClick={() => { setQ(''); setSkill(''); setSector(''); setService(''); setMode(''); setCity(''); run(1, {}); }}>مسح</button></div>
      </form>
      <p className="dr-count" role="status" aria-live="polite" data-testid="dir-count">{busy ? 'جارٍ البحث…' : total ? `${total} ${face === 'expert' ? 'خبيرًا' : 'مدربًا'} — صفحة ${page} من ${pages} · الترتيب: آخر تحديث ثم الاسم` : 'لا نتائج بهذه المعايير — جرّب كلمة أعمّ أو امسح المرشّحات.'}</p>
      {err && <p className="dr-err" role="alert">{err}</p>}
      <ul className="dr-grid" aria-label="النتائج">
        {items.map(c => (<li key={c.slug} className="dr-card" data-testid="dir-card">
          <Avatar src={c.photo_url} name={c.name_ar} />
          <div className="dr-cbody">
            <h2><Link href={`/${PATH[face]}/${c.slug}`}>{c.name_ar}</Link></h2>
            <p className="dr-title">{c.title_ar}</p>
            <p className="dr-chips">{c.skill_names.map(s => <span key={s} className="dr-chip">{s}</span>)}{c.sectors.map(s => <span key={s} className="dr-chip sec">{sectorName[s] || s}</span>)}</p>
            <p className="dr-meta">{c.city && <span><Icon name="globe" size={12} /> {c.city}</span>}<span>{c.modes.map(m => meta?.rules.modes.find(x => x.code === m)?.name_ar || m).join(' · ')}</span>{c.cards[face] && <span className="dr-badge"><Icon name="certificate" size={12} /> موثَّق {c.cards[face]!.code}</span>}</p>
          </div>
        </li>))}
      </ul>
      {pages > 1 && <nav className="dr-pager" aria-label="الصفحات"><button className="pt-btn ghost small" disabled={page <= 1 || busy} onClick={() => run(page - 1)}>السابقة</button><span>صفحة {page} من {pages}</span><button className="pt-btn ghost small" disabled={page >= pages || busy} onClick={() => run(page + 1)}>التالية</button></nav>}
      <p className="dr-privacy"><Icon name="shield" size={13} /> {meta?.privacy_ar || 'لا يظهر بريد ولا هاتف لأحد؛ الطلبات تصل عبر أَثَر وحده.'}</p>
    </main>
  );
}

export function DirectoryProfile({ slug, face }: { slug: string; face: Face }) {
  const [p, setP] = useState<PubProfile | null>(null); const [w, setW] = useState<{ lines: { key: string; text: string }[]; empty_ar: string | null } | null>(null); const [meta, setMeta] = useState<Meta | null>(null); const [err, setErr] = useState(''); const [hint, setHint] = useState('');
  const [kind, setKind] = useState<'consult' | 'train'>(face === 'trainer' ? 'train' : 'consult'); const [fn, setFn] = useState(''); const [em, setEm] = useState(''); const [ph, setPh] = useState(''); const [org, setOrg] = useState(''); const [title, setTitle] = useState(''); const [details, setDetails] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(''); const [rerr, setRerr] = useState('');
  useEffect(() => { fetch(`/api/directory?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' }).then(r => r.json()).then(j => { if (j?.success) { setP(j.profile); setW(j.witness); setHint(j.request_hint_ar || ''); } else setErr(j?.error || 'لا صفحة بهذا العنوان'); }).catch(() => setErr('انقطع الاتصال')); fetch('/api/directory?meta=1', { cache: 'no-store' }).then(r => r.json()).then(j => { if (j?.success) setMeta(j); }).catch(() => null); }, [slug]);
  async function send(e: React.FormEvent) { e.preventDefault(); setBusy(true); setRerr(''); try { const j = await fetch('/api/directory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request', slug, kind, full_name: fn, email: em, phone: ph, organization: org, title, details }) }).then(r => r.json()); if (j?.success) setDone(j.message_ar); else setRerr(j?.error || 'تعذّر الإرسال'); } catch { setRerr('انقطع الاتصال'); } finally { setBusy(false); } }
  const sectorName = meta ? nameMap(meta.sectors) : {}; const svcName = meta ? nameMap(meta.rules.services) : {}; const modeName = meta ? nameMap(meta.rules.modes) : {}; const langName = meta ? nameMap(meta.rules.languages) : {};
  if (err) return <main className="dr" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} /><p className="dr-err" role="alert">{err}</p><p><Link className="pt-btn ghost small" href={`/${PATH[face]}`}>العودة إلى {face === 'expert' ? 'هيئة أَثَر للخبراء' : 'هيئة أَثَر للمدربين'}</Link></p></main>;
  if (!p) return <main className="dr" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} /><p className="dr-count" role="status">جارٍ فتح الصفحة…</p></main>;
  const card = p.cards[face] || p.cards.expert || p.cards.trainer;
  return (
    <main className="dr" dir="rtl" data-testid="dir-profile"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <nav className="dr-crumbs" aria-label="المسار"><Link href={`/${PATH[face]}`}>{face === 'expert' ? 'هيئة أَثَر للخبراء' : 'هيئة أَثَر للمدربين'}</Link> <span aria-hidden="true">›</span> <span aria-current="page">{p.name_ar}</span></nav>
      <header className="dr-phead">
        <Avatar src={p.photo_url} name={p.name_ar} size={128} />
        <div>
          <p className="dr-facechips">{p.faces.map(f => <span key={f} className="dr-chip face">{meta?.rules.faces_ar[f] || f}</span>)}</p>
          <h1>{p.name_ar}{p.name_en && <small lang="en" dir="ltr">{p.name_en}</small>}</h1>
          <p className="dr-title big">{p.title_ar}</p>
          <p className="dr-meta">{p.city && <span><Icon name="globe" size={13} /> {p.city}</span>}{p.languages.length > 0 && <span>{p.languages.map(l => langName[l] || l).join(' · ')}</span>}{p.modes.length > 0 && <span>{p.modes.map(m => modeName[m] || m).join(' · ')}</span>}</p>
          {card && <p className="dr-cert" data-testid="dir-cert"><Icon name="certificate" size={14} /> شهادة توثيق أَثَر <b dir="ltr">{card.code}</b> · {fmtD(card.issued_at)} · <a href={`/verify/vc?code=${encodeURIComponent(card.code)}`}>تحقّق</a></p>}
        </div>
      </header>
      <div className="dr-two">
        <div>
          {p.summary_ar && <section className="dr-sec" aria-labelledby="s-sum"><h2 id="s-sum"><Icon name="doc" size={16} /> ملخص السيرة</h2><p className="dr-summary">{p.summary_ar}</p></section>}
          {p.achievements.length > 0 && <section className="dr-sec" aria-labelledby="s-ach"><h2 id="s-ach"><Icon name="award" size={16} /> أبرز الإنجازات</h2><ul className="dr-list">{p.achievements.map((a, i) => <li key={i}>{a}</li>)}</ul></section>}
          {p.experience.length > 0 && <section className="dr-sec" aria-labelledby="s-exp"><h2 id="s-exp"><Icon name="trend" size={16} /> الخبرات العملية</h2><ul className="dr-rows">{p.experience.map((x, i) => <li key={i}><b>{x.role}</b> — {x.organization} <small>{x.from}{x.to ? ` → ${x.to}` : ' → الآن'}</small>{x.line && <p>{x.line}</p>}</li>)}</ul></section>}
          {p.education.length > 0 && <section className="dr-sec" aria-labelledby="s-edu"><h2 id="s-edu"><Icon name="school" size={16} /> المؤهلات العلمية</h2><ul className="dr-rows">{p.education.map((x, i) => <li key={i}><b>{x.degree}</b>{x.field && ` في ${x.field}`} — {x.institution} <small>{x.year}</small></li>)}</ul></section>}
          {p.certifications.length > 0 && <section className="dr-sec" aria-labelledby="s-cert"><h2 id="s-cert"><Icon name="certificate" size={16} /> الشهادات المهنية</h2><ul className="dr-rows">{p.certifications.map((x, i) => <li key={i}><b>{x.name}</b> — {x.issuer} <small>{x.year}</small></li>)}</ul></section>}
          {p.publications.length > 0 && <section className="dr-sec" aria-labelledby="s-pub"><h2 id="s-pub"><Icon name="book" size={16} /> المنشورات والأعمال</h2><ul className="dr-rows">{p.publications.map((x, i) => <li key={i}><b>{x.url ? <a href={x.url} target="_blank" rel="noreferrer">{x.title}</a> : x.title}</b> <small>{x.type} · {x.year}</small></li>)}</ul></section>}
        </div>
        <aside>
          <section className="dr-sec side" aria-labelledby="s-wit"><h2 id="s-wit"><Icon name="shield" size={16} /> ما شهده أَثَر</h2>
            {w ? (w.lines.length ? <ul className="dr-witness" data-testid="dir-witness">{w.lines.map(l => <li key={l.key}><Icon name="check" size={13} /> {l.text}</li>)}</ul> : <p className="dr-muted">{w.empty_ar}</p>) : <p className="dr-muted">اختار العضو إخفاء هذا القسم.</p>}
            <p className="dr-fine">مشتق من سجلات المنصة ولا يُكتب باليد.</p></section>
          <section className="dr-sec side" aria-labelledby="s-exp2"><h2 id="s-exp2"><Icon name="target" size={16} /> مجالات الخبرة</h2><p className="dr-chips">{p.skill_names.map(s => <span key={s} className="dr-chip">{s}</span>)}</p>
            <h3>القطاعات</h3><p className="dr-chips">{p.sectors.map(s => <span key={s} className="dr-chip sec">{sectorName[s] || s}</span>)}</p>
            <h3>الخدمات</h3><p className="dr-chips">{p.services.map(s => <span key={s} className="dr-chip svc">{svcName[s] || s}</span>)}</p>
            {p.coverage.length > 0 && <><h3>نطاق التغطية</h3><p className="dr-muted">{p.coverage.join(' · ')}</p></>}
            <p className="dr-fine">آخر تحديث للسيرة: {fmtD(p.updated_at)}</p></section>
          <section className="dr-sec side ask" aria-labelledby="s-ask"><h2 id="s-ask"><Icon name="send" size={16} /> اطلب {p.name_ar.split(' ')[0]} عبر أَثَر</h2>
            <p className="dr-muted">{hint}</p>
            {done ? <p className="dr-ok" role="status" data-testid="dir-req-ok">{done}</p> : (
              <form onSubmit={send} className="dr-form">
                <fieldset className="dr-fs"><legend>نوع الطلب</legend><label><input type="radio" name="kind" checked={kind === 'consult'} onChange={() => setKind('consult')} /> استشارة</label><label><input type="radio" name="kind" checked={kind === 'train'} onChange={() => setKind('train')} /> تدريب</label></fieldset>
                <label className="dr-lbl">اسمك<input className="dr-in" value={fn} onChange={e => setFn(e.target.value)} required maxLength={120} autoComplete="name" data-testid="req-name" /></label>
                <label className="dr-lbl">بريدك<input className="dr-in" type="email" value={em} onChange={e => setEm(e.target.value)} required autoComplete="email" dir="ltr" data-testid="req-email" /></label>
                <label className="dr-lbl">جوالك (اختياري)<input className="dr-in" value={ph} onChange={e => setPh(e.target.value)} maxLength={30} autoComplete="tel" dir="ltr" /></label>
                <label className="dr-lbl">جهتك (اختياري)<input className="dr-in" value={org} onChange={e => setOrg(e.target.value)} maxLength={160} autoComplete="organization" /></label>
                <label className="dr-lbl">عنوان الطلب<input className="dr-in" value={title} onChange={e => setTitle(e.target.value)} required maxLength={160} data-testid="req-title" /></label>
                <label className="dr-lbl">التفاصيل <small>(20 حرفًا فأكثر)</small><textarea className="dr-in" rows={4} value={details} onChange={e => setDetails(e.target.value)} required minLength={20} maxLength={3000} data-testid="req-details" /></label>
                {rerr && <p className="dr-err" role="alert">{rerr}</p>}
                <button className="pt-btn" type="submit" disabled={busy} data-testid="req-send"><Icon name="send" size={15} /> أرسل إلى أَثَر</button>
              </form>)}
          </section>
        </aside>
      </div>
    </main>
  );
}

export const CSS = `
.dr{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;max-width:1100px;margin:0 auto;padding:24px 18px 60px}
.dr :is(button,a,input,select,textarea):focus-visible{outline:3px solid #0f2a4e;outline-offset:2px;border-radius:8px}
.dr-hero h1{margin:8px 0 6px;font-size:30px;color:#0f2a4e}.dr-hero p{margin:0 0 12px;color:#334155;line-height:1.9;font-size:15px;max-width:820px}
.dr-faces{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 14px}.dr-face{border:1px solid #cbd5e1;border-radius:999px;padding:7px 14px;font-weight:800;font-size:13px;color:#0f2a4e;text-decoration:none;background:#fff;display:inline-flex;gap:6px;align-items:center;min-height:24px}.dr-face.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.dr-face.join{border-color:#c9a24b;background:#fffdf7}
.dr-search{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr auto;gap:10px;align-items:end;background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:14px}.dr-lbl{display:block;font-size:13px;font-weight:800;color:#1e293b}.dr-lbl small{font-weight:600;color:#475569}.dr-in{width:100%;box-sizing:border-box;font:inherit;border:1px solid #94a3b8;border-radius:12px;padding:9px 12px;margin-top:4px;background:#fff;color:#0f172a;min-height:40px}.dr-sbtns{display:flex;gap:6px}
.dr-count{margin:12px 0 6px;color:#334155;font-weight:800;font-size:14px}.dr-err{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}.dr-ok{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800;line-height:1.8}
.dr-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}.dr-card{display:grid;grid-template-columns:auto 1fr;gap:12px;border:1px solid #cbd5e1;border-radius:18px;padding:14px;background:#fff}.dr-card h2{margin:0;font-size:17px}.dr-card h2 a{color:#0f2a4e;text-decoration:none}.dr-card h2 a:hover{text-decoration:underline}
.dr-photo{border-radius:16px;object-fit:cover;background:#e2e8f0;display:inline-flex;align-items:center;justify-content:center;color:#0f2a4e;font-weight:900;flex:none}.dr-noimg{background:linear-gradient(135deg,#e6f7f5,#fffdf7)}
.dr-title{margin:2px 0 6px;color:#0b6f69;font-weight:800;font-size:13.5px}.dr-title.big{font-size:16px}.dr-chips{margin:4px 0;display:flex;flex-wrap:wrap;gap:5px}.dr-chip{background:#e2e8f0;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800;color:#0f2a4e}.dr-chip.sec{background:#fffdf7;border:1px solid #c9a24b;color:#7c5a12}.dr-chip.svc{background:#e6f7f5;color:#0b6f69}.dr-chip.face{background:#0f2a4e;color:#fff}
.dr-meta{margin:4px 0 0;display:flex;flex-wrap:wrap;gap:10px;font-size:12.5px;color:#475569}.dr-meta span{display:inline-flex;gap:4px;align-items:center}.dr-badge{color:#0b6f69;font-weight:800}
.dr-pager{display:flex;gap:12px;align-items:center;justify-content:center;margin:16px 0;font-weight:800;color:#0f2a4e}.dr-privacy{display:flex;gap:6px;align-items:flex-start;color:#334155;font-size:12.5px;line-height:1.8;margin-top:18px}
.dr-crumbs{font-size:13px;color:#475569;margin-bottom:10px}.dr-crumbs a{color:#0f2a4e}
.dr-phead{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center;background:linear-gradient(135deg,#f8fafc,#fff);border:1px solid #e2e8f0;border-radius:22px;padding:18px}.dr-phead h1{margin:4px 0;font-size:26px;color:#0f2a4e}.dr-phead h1 small{font-size:14px;color:#475569;font-weight:700;margin-inline-start:10px;display:inline-block}.dr-facechips{margin:0}
.dr-cert{margin:8px 0 0;display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap;background:#e6f7f5;color:#0b6f69;border-radius:999px;padding:5px 12px;font-size:13px;font-weight:800}.dr-cert a{color:#0b6f69}
.dr-two{display:grid;grid-template-columns:1.6fr 1fr;gap:16px;margin-top:16px}.dr-sec{margin:0 0 16px}.dr-sec h2{margin:0 0 8px;font-size:17px;color:#0f2a4e;display:inline-flex;gap:8px;align-items:center}.dr-sec h3{margin:10px 0 4px;font-size:13px;color:#0b6f69}.dr-sec.side{border:1px solid #cbd5e1;border-radius:16px;padding:12px 14px;background:#fff}.dr-sec.ask{background:#fffdf7;border-color:#c9a24b}
.dr-summary{white-space:pre-wrap;line-height:1.95;color:#1e293b;font-size:15px;margin:0}.dr-list{margin:0;padding:0 18px 0 0;line-height:1.9;color:#1e293b}.dr-rows{list-style:none;margin:0;padding:0;display:grid;gap:8px}.dr-rows li{border-inline-start:3px solid #c9a24b;padding:4px 12px;line-height:1.8;color:#1e293b}.dr-rows b{color:#0f2a4e}.dr-rows small{color:#475569;margin-inline-start:6px}.dr-rows p{margin:2px 0 0;color:#334155;font-size:13.5px}
.dr-witness{list-style:none;margin:0;padding:0;display:grid;gap:6px}.dr-witness li{display:flex;gap:6px;align-items:flex-start;color:#065f46;background:#ecfdf5;border-radius:10px;padding:6px 10px;font-size:13.5px;line-height:1.7}.dr-muted{color:#475569;font-size:13.5px;line-height:1.8;margin:4px 0}.dr-fine{color:#64748b;font-size:11.5px;margin:8px 0 0}
.dr-form{display:grid;gap:4px}.dr-fs{border:1px solid #cbd5e1;border-radius:12px;padding:6px 12px;display:flex;gap:14px;margin:4px 0}.dr-fs legend{font-size:12px;font-weight:800;color:#1e293b;padding:0 6px}.dr-fs label{display:inline-flex;gap:6px;align-items:center;font-size:14px}
@media (max-width:900px){.dr-search{grid-template-columns:1fr 1fr}.dr-lbl.grow{grid-column:span 2}.dr-two{grid-template-columns:1fr}.dr-phead{grid-template-columns:1fr;justify-items:center;text-align:center}.dr-meta{justify-content:center}}
`;
