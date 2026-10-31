'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// P33 «أَثَر معك — على الهواء»: زر الرأس (العدد الحي) + حوار «أَثَر معك» (من على الهواء · ثلاث درجات · الطلب) + الخيط (Thread) المشترك مع /me/onair.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase/client';
import { fastToken } from './Pocket';
import { Icon } from '../../lib/ui/icons';
import { GRADES, GRADE_LABEL, GRADE_HINT, QUICK_TIMEOUT_MIN, TEXT_MAX, CHANGED_MAX, dialogDefaults, BOTTLE_AR, BOTTLE_HOURS, CITY_POINTS } from '../../lib/onair/registry';
import type { Grade } from '../../lib/onair/registry';

type Lang = 'ar' | 'en';
const EVT = 'athar:onair';
export const openOnAir = (grade?: Grade) => { try { window.dispatchEvent(new CustomEvent(EVT, { detail: { open: true, grade } })); } catch { /* ssr */ } };
const tokKey = (id: string | number) => `athar_onair_t:${id}`;
export const rememberAnon = (id: string | number, t: string | null) => { try { if (t) localStorage.setItem(tokKey(id), t); } catch { /* صامت */ } };
export const anonTokenFor = (id: string | number) => { try { return localStorage.getItem(tokKey(id)) || ''; } catch { return ''; } };
async function api(path: string, body?: any) {
  const tk = await fastToken(supabase()).catch(() => '');
  const r = await fetch(path, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, j };
}

/** زر الرأس: «أَثَر معك · N على الهواء» — يُحدَّث كل 45 ثانية */
export function OnAirButton({ lang }: { lang: Lang }) {
  const ar = lang === 'ar'; const [n, setN] = useState<number | null>(null); const [signed, setSigned] = useState(false);
  useEffect(() => { let alive = true; const load = () => fetch('/api/onair?now=1', { cache: 'no-store' }).then(r => r.json()).then(j => { if (alive && j?.success) { setN(Number(j.count) || 0); setSigned(Number(j.stats?.faces?.interpreter || 0) > 0); } }).catch(() => null); load(); const id = setInterval(load, 45000); return () => { alive = false; clearInterval(id); }; }, []);
  return <button type="button" className={`oa-btn ${n ? 'live' : ''}`} onClick={() => openOnAir()} aria-haspopup="dialog" data-testid="oa-open" title={ar ? 'أَثَر معك — اسأل الآن، فثمّة إنسان يسمعك' : 'Athar with you — ask now, a human is listening'}>
    <span className="oa-dot" aria-hidden="true" /> {ar ? 'أَثَر معك' : 'Athar with you'}{n !== null && <b data-testid="oa-count">{n}</b>}{signed && <span className="oa-hand" data-testid="oa-hand" title={ar ? 'مترجم لغة إشارة على الهواء الآن' : 'Sign-language interpreter on air now'}>🤟<span className="oa-sr">{ar ? ' · مترجم إشارة على الهواء' : ' · interpreter on air'}</span></span>}<span className="oa-sr">{n ? (ar ? ` · ${n} على الهواء` : ` · ${n} on air`) : (ar ? ' · لا أحد على الهواء الآن' : ' · nobody on air now')}</span>
  </button>;
}

/** سطر حيّ للصفحة الرئيسية: «الآن N إنسان على الهواء» */
export function OnAirLine({ lang }: { lang: Lang }) {
  const ar = lang === 'ar'; const [d, setD] = useState<{ count: number; faces: string[]; golden: any | null; map: any } | null>(null);
  useEffect(() => { let alive = true; const load = () => fetch('/api/onair?now=1', { cache: 'no-store' }).then(r => r.json()).then(j => { if (alive && j?.success) setD({ count: Number(j.count) || 0, faces: Array.from(new Set((j.present || []).map((p: any) => String(p.face_ar)))) as string[], golden: j.golden || null, map: j.map || null }); }).catch(() => null); load(); const id = setInterval(load, 60000); return () => { alive = false; clearInterval(id); }; }, []);
  if (!d) return null;
  return <><p className="oa-line" data-testid="oa-line"><span className={`oa-dot ${d.count ? 'on' : ''}`} aria-hidden="true" /> {d.count ? (ar ? <>الآن <b>{d.count}</b> {d.count === 1 ? 'إنسان' : d.count === 2 ? 'إنسانان' : 'أناس'} على الهواء في «أَثَر معك»{d.faces.length ? ` (${d.faces.join('، ')})` : ''} — </> : <>Right now <b>{d.count}</b> on air in “Athar with you” — </>) : (ar ? 'لا أحد على الهواء هذه اللحظة — اترك طلبك يصل أول من يصعد — ' : 'Nobody on air this minute — leave a request — ')}<button type="button" className="oa-linebtn" onClick={() => openOnAir()} data-testid="oa-line-btn">{ar ? 'اسأل إنسانًا الآن' : 'Ask a human now'}</button></p>{d.golden && <p className="oa-golden" data-testid="oa-golden-line"><span aria-hidden="true">✦</span> {ar ? <>{d.golden.title_ar}: {d.golden.live ? <b>جارية الآن</b> : <b>{d.golden.countdown_ar}</b>} · {d.golden.weekday_ar} {d.golden.from} · <b>{d.golden.pledged}</b> تعهّدوا بالحضور</> : <>{d.golden.title_ar}: {d.golden.live ? <b>live now</b> : <b>in {d.golden.minutes_to} min</b>} · {d.golden.pledged} pledged</>} <Link href="/on-air">{ar ? 'التفاصيل' : 'Details'}</Link></p>}{d.count > 0 && d.map?.points?.length > 0 && <OnAirMap map={d.map} lang={lang} compact />}</>;
}

type PresentRow = { user_id: string | null; face: string; face_ar: string; receives: Grade[]; domains: string[]; minutes_left: number; name_ar: string | null; slug: string | null; photo_url: string | null; title_ar: string | null };
type NowPayload = { present: PresentRow[]; count: number; stats: any; upcoming: any[]; faq: any[]; signed_in: boolean; privacy_ar: string; tagline_ar: string; golden?: any; map?: { points: { key: string; ar: string; x: number; y: number; n: number }[]; other: number; total: number }; bottles?: number; orgs?: { id: string; name_ar: string }[] };

/** 6) خريطة الحضور الحيّة — أعداد بالمدن، بلا أسماء (SVG مضمّن، بلا خرائط خارجية) */
export function OnAirMap({ map, lang, compact = false }: { map: NowPayload['map'] | null | undefined; lang: Lang; compact?: boolean }) {
  const ar = lang === 'ar'; const pts = map?.points || []; const total = map?.total || 0;
  return <figure className={`oa-map ${compact ? 'compact' : ''}`} data-testid="oa-map" data-points={pts.length}>
    <svg viewBox="0 0 100 100" role="img" aria-labelledby="oa-map-t" preserveAspectRatio="xMidYMid meet">
      <title id="oa-map-t">{ar ? `خريطة الحضور الحيّة: ${total} على الهواء${pts.length ? ' — ' + pts.map(p => `${p.ar} ${p.n}`).join('، ') : ''}` : `Live map: ${total} on air`}</title>
      <path d="M12 20 L22 12 L34 10 L46 14 L58 10 L70 14 L80 24 L84 36 L80 48 L74 58 L66 70 L56 82 L46 92 L36 94 L30 88 L26 78 L20 66 L14 52 L10 38 Z" className="oa-map-land" />
      {Object.entries(CITY_POINTS).filter(([k]) => ['riyadh', 'jeddah', 'madinah', 'dammam', 'abha', 'tabuk', 'hail', 'buraidah', 'najran', 'jazan', 'sakaka'].includes(k)).map(([k, c]) => <circle key={k} cx={c.x} cy={c.y} r={0.9} className="oa-map-city" />)}
      {pts.map(p => <g key={p.key} className="oa-map-pt"><circle cx={p.x} cy={p.y} r={2.2 + Math.min(4, p.n)} className="oa-map-pulse" /><circle cx={p.x} cy={p.y} r={2} className="oa-map-dot" /><text x={p.x + 3.5} y={p.y + 1.2} className="oa-map-lbl">{p.ar} {p.n}</text></g>)}
    </svg>
    {!compact && <figcaption>{ar ? (total ? `${total} على الهواء الآن${pts.length ? ' — ' + pts.map(p => `${p.ar} (${p.n})`).join(' · ') : ''}${map?.other ? ` · بلا مدينة معلنة: ${map.other}` : ''}` : 'لا أحد على الهواء الآن — تنبض الخريطة حين يصعد إنسان.') : (total ? `${total} on air now` : 'Nobody on air right now.')}</figcaption>}
  </figure>;
}

/** حوار «أَثَر معك» */
export function OnAirPanel({ lang }: { lang: Lang }) {
  const ar = lang === 'ar'; const [open, setOpen] = useState(false); const [grade, setGrade] = useState<Grade | null>(null); const [now, setNow] = useState<NowPayload | null>(null);
  const [text, setText] = useState(''); const [domain, setDomain] = useState(''); const [alias, setAlias] = useState(''); const [interp, setInterp] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [alts, setAlts] = useState<string[] | null>(null);
  const [preferText, setPreferText] = useState(false); const [canBottle, setCanBottle] = useState<string | null>(null); const [orgId, setOrgId] = useState(''); const [defNote, setDefNote] = useState<string | null>(null); const applied = useRef(false);
  const [thread, setThread] = useState<{ id: string | number; t: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null); const last = useRef<HTMLElement | null>(null);
  const load = useCallback(() => api('/api/onair?now=1').then(r => { if (r.j?.success) setNow(r.j); }), []);
  useEffect(() => { const on = (e: Event) => { const d = (e as CustomEvent).detail || {}; setOpen(true); setGrade(d.grade || null); setThread(null); setErr(''); setAlts(null); }; window.addEventListener(EVT, on); if (typeof window !== 'undefined' && (window.location.hash === '#onair' || new URLSearchParams(window.location.search).get('onair') === '1')) setOpen(true); return () => window.removeEventListener(EVT, on); }, []);
  useEffect(() => {   // 7) الهواء بالإشارة · 2) الهواء الصامت — من «احتياجاتي» على المتصفح فقط؛ لا يُرسل شيء
    if (!open || applied.current) return; applied.current = true;
    (async () => { const tk = await fastToken(supabase()).catch(() => ''); if (!tk) return; const r = await api('/api/inclusion?mine=1'); const needs: string[] = r.j?.profile?.needs || []; const d = dialogDefaults(needs); if (d.grade) setGrade(g => g || d.grade); if (d.interpreter) setInterp(true); if (d.prefer_text) setPreferText(true); setDefNote(d.note_ar); })().catch(() => null);
  }, [open]);
  useEffect(() => { if (open) { load(); last.current = document.activeElement as HTMLElement; setTimeout(() => ref.current?.querySelector<HTMLElement>('button,input,[tabindex]')?.focus(), 30); } else last.current?.focus?.(); }, [open, load]);
  useEffect(() => {
    if (!open) return; const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === 'Tab' && ref.current) { const f = Array.from(ref.current.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href],[tabindex]:not([tabindex="-1"])')).filter(x => !x.hasAttribute('disabled')); if (!f.length) return; const i = f.indexOf(document.activeElement as HTMLElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
    }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  const present = now?.present || []; const forGrade = (g: Grade) => present.filter(p => p.receives.includes(g)).length;
  const domains = Array.from(new Set(present.flatMap(p => p.domains))).slice(0, 20);
  async function ask(bottle = false) {
    if (!grade) return; setBusy(true); setErr(''); setAlts(null); setCanBottle(null);
    const r = await api('/api/onair', { action: 'ask', kind: grade, text, domain: domain || undefined, alias: alias || undefined, interpreter_wanted: interp, prefer_text: preferText, org_id: orgId || undefined, bottle });
    setBusy(false);
    if (r.status === 409 && r.j?.nobody) { setAlts(r.j.alternatives_ar || []); setErr(r.j.error || ''); if (r.j.can_bottle) setCanBottle(r.j.bottle_ar || BOTTLE_AR); return; }
    if (!r.ok) { setErr(r.j?.error || (ar ? 'تعذّر الإرسال' : 'Failed')); return; }
    rememberAnon(r.j.request.id, r.j.t || null); setThread({ id: r.j.request.id, t: r.j.t || '' }); setText('');
  }
  return <div className="ax-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
    <div className="ax-panel oa-panel" role="dialog" aria-modal="true" aria-labelledby="oa-title" ref={ref} data-testid="oa-panel">
      <header className="ax-head"><h2 id="oa-title"><Icon name="chat" size={18} /> {ar ? 'أَثَر معك — على الهواء' : 'Athar with you — on air'}</h2><button type="button" className="ax-x" onClick={() => setOpen(false)} aria-label={ar ? 'إغلاق' : 'Close'}>✕</button></header>
      <div className="ax-body">
        {thread ? <Thread id={thread.id} t={thread.t} lang={lang} onBack={() => { setThread(null); setGrade(null); load(); }} /> : <>
          <p className="ax-lead">{ar ? (now?.tagline_ar || 'اسأل الآن… فثمّة إنسان يسمعك') : 'Ask now — a human is listening.'} <span className="oa-live" data-testid="oa-live">{now ? (ar ? `${now.count} على الهواء الآن` : `${now.count} on air now`) : '…'}</span></p>
          {now?.golden && <p className="oa-golden" data-testid="oa-golden"><span aria-hidden="true">✦</span> {now.golden.title_ar} · {now.golden.live ? (ar ? 'جارية الآن' : 'live now') : now.golden.countdown_ar} · {now.golden.weekday_ar} {now.golden.from} · {now.golden.pledged} {ar ? 'تعهّدوا' : 'pledged'}</p>}
          {defNote && <p className="oa-warn" role="status" data-testid="oa-defnote">{defNote}</p>}
          {!grade && <>
            <ul className="oa-grades" data-testid="oa-grades">{GRADES.map(g => <li key={g}><button type="button" className="oa-grade" onClick={() => setGrade(g)} data-testid={`oa-grade-${g}`}><b>{GRADE_LABEL[g][lang]}</b><small>{GRADE_HINT[g][lang]}</small><span className="oa-n">{g === 'consult' ? (ar ? 'دائمًا' : 'always') : `${forGrade(g)} ${ar ? 'حاضر' : 'present'}`}</span></button></li>)}</ul>
            <h3 className="oa-h">{ar ? 'من على الهواء الآن' : 'On air now'}</h3>
            {present.length === 0 && <p className="ax-muted">{ar ? 'لا أحد الآن — انظر النوافذ القادمة أو اترك استشارة تصل الطاقم.' : 'Nobody right now — see upcoming windows or leave a consultation request.'}</p>}
            <ul className="oa-people" data-testid="oa-people">{present.map((p, i) => <li key={p.user_id || i}>
              <span className="oa-ava" aria-hidden="true">{p.photo_url ? <img src={p.photo_url} alt="" /> : <Icon name="users" size={16} />}</span>
              <span><b>{p.name_ar || (ar ? 'عضو هيئة أَثَر' : 'Athar Faculty member')}</b><small>{p.face_ar}{p.title_ar ? ` · ${p.title_ar}` : ''}{p.domains.length ? ` · ${p.domains.slice(0, 3).join(' · ')}` : ''} · {ar ? `${p.minutes_left} د متبقية` : `${p.minutes_left} min left`}</small>{p.slug && <Link href={`/experts/${p.slug}`} className="oa-link">{ar ? 'سيرته' : 'Profile'}</Link>}</span>
            </li>)}</ul>
            {!now?.signed_in && present.length > 0 && <p className="ax-muted">{ar ? 'الأسماء والصور تظهر بعد تسجيل الدخول — ' : 'Names appear after sign-in — '}<Link href="/login">{ar ? 'سجّل الدخول' : 'Sign in'}</Link></p>}
            {!!now?.upcoming?.length && <><h3 className="oa-h">{ar ? 'نوافذ قادمة' : 'Upcoming windows'}</h3><ul className="oa-wins">{now!.upcoming.slice(0, 5).map((w: any) => <li key={w.id}><b>{w.weekday_ar} {w.from}–{w.to}</b> {w.name_ar ? `· ${w.name_ar}` : ''} {w.note_ar ? <small>· {w.note_ar}</small> : null}</li>)}</ul></>}
            <p className="ax-foot"><Link href="/on-air">{ar ? 'الصفحة الكاملة · كيف يعمل · أسئلة أجاب عنها الهواء' : 'Full page · how it works · answered questions'}</Link></p>
          </>}
          {grade && <form onSubmit={e => { e.preventDefault(); ask(); }} className="oa-form" data-testid="oa-form">
            <p className="oa-pick"><button type="button" className="ax-btn" onClick={() => setGrade(null)}>← {ar ? 'الدرجات' : 'Grades'}</button> <b>{GRADE_LABEL[grade][lang]}</b> <small>{GRADE_HINT[grade][lang]}</small></p>
            {grade !== 'consult' && forGrade(grade) === 0 && <p className="oa-warn" role="status">{ar ? 'لا أحد يستقبل هذه الدرجة الآن — جرّب درجة أخرى أو انتظر نافذة قادمة.' : 'Nobody receives this grade right now.'}</p>}
            <label className="ax-field">{ar ? 'سؤالك أو ما تحتاجه' : 'Your question'}<textarea value={text} onChange={e => setText(e.target.value.slice(0, TEXT_MAX))} rows={4} required minLength={5} data-testid="oa-text" placeholder={ar ? 'بكلماتك — بلا بيانات شخصية' : 'In your words'} /><small className="ax-muted">{text.length}/{TEXT_MAX}</small></label>
            <div className="oa-row">
              <label className="ax-field">{ar ? 'المجال (اختياري)' : 'Domain (optional)'}<select value={domain} onChange={e => setDomain(e.target.value)} data-testid="oa-domain"><option value="">{ar ? 'أي مجال' : 'Any'}</option>{domains.map(d => <option key={d} value={d}>{d}</option>)}</select></label>
              {!now?.signed_in && <label className="ax-field">{ar ? 'اسم مستعار (اختياري)' : 'Alias (optional)'}<input value={alias} onChange={e => setAlias(e.target.value.slice(0, 40))} data-testid="oa-alias" /></label>}
            </div>
            <label className="oa-check"><input type="checkbox" checked={interp} onChange={e => setInterp(e.target.checked)} data-testid="oa-interp" /> {ar ? 'أحتاج مترجم لغة إشارة في اللقاء' : 'I need a sign-language interpreter'}</label>
            <label className="oa-check"><input type="checkbox" checked={preferText} onChange={e => setPreferText(e.target.checked)} data-testid="oa-prefer-text" /> {ar ? 'أفضّل النصّ (الهواء الصامت)' : 'I prefer text (Quiet Air)'}</label>
            {!!now?.orgs?.length && grade !== 'consult' && <label className="ax-field">{ar ? 'نطاق الطلب' : 'Scope'}<select value={orgId} onChange={e => setOrgId(e.target.value)} data-testid="oa-org"><option value="">{ar ? 'الهواء العام — كل هيئة أَثَر' : 'Public air'}</option>{now!.orgs!.map(o => <option key={o.id} value={o.id}>{ar ? `داخل جهتي فقط — ${o.name_ar} (هواء الجهة)` : `My organization only — ${o.name_ar}`}</option>)}</select></label>}
            {!now?.signed_in && grade !== 'quick' && <p className="oa-warn" role="status">{ar ? 'جلسة الدعم والاستشارة تحتاجان تسجيل الدخول؛ «عونٌ سريع» متاح للجميع.' : 'Sessions and consultations require sign-in.'} <Link href="/login">{ar ? 'سجّل الدخول' : 'Sign in'}</Link></p>}
            <div className="ax-actions"><button type="submit" className="pt-btn gold" disabled={busy || text.trim().length < 5} data-testid="oa-send">{busy ? '…' : ar ? 'أرسل إلى الهواء' : 'Send on air'}</button></div>
            {err && <p className="oa-err" role="alert" data-testid="oa-err">{err}</p>}
            {canBottle && <p className="oa-bottle" data-testid="oa-bottle"><button type="button" className="pt-btn navy small" disabled={busy} onClick={() => ask(true)} data-testid="oa-bottle-send">🍾 {ar ? `اترك «${BOTTLE_AR}»` : 'Leave a message in a bottle'}</button> <small>{canBottle}</small></p>}
            {alts && <ul className="oa-alts" data-testid="oa-alts">{alts.map((a, i) => <li key={i}>{a}</li>)}<li><Link href="/contact">{ar ? 'تواصل مع الطاقم' : 'Contact staff'}</Link></li></ul>}
            <p className="ax-foot">{now?.privacy_ar}</p>
          </form>}
        </>}
      </div>
    </div>
  </div>;
}

type Msg = { id: string | number; from_role: string; text_ar: string; created_at: string };
/** الخيط: ينتظر الردّ (3 دقائق) → معك الآن → انتهى؛ مشترك بين الطالب والمُستقبِل */
export function Thread({ id, t, lang, onBack, receiver = false }: { id: string | number; t: string; lang: Lang; onBack?: () => void; receiver?: boolean }) {
  const ar = lang === 'ar'; const [data, setData] = useState<any>(null); const [msgs, setMsgs] = useState<Msg[]>([]); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [changed, setChanged] = useState(''); const [note, setNote] = useState(''); const [summary, setSummary] = useState<string | null>(null);
  const [tick, setTick] = useState(0); const box = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => { const r = await api(`/api/onair?request=${encodeURIComponent(String(id))}${t ? `&t=${encodeURIComponent(t)}` : ''}`); if (r.j?.success) { setData(r.j); setMsgs(r.j.messages || []); } }, [id, t]);
  useEffect(() => { load(); const i = setInterval(() => { load(); setTick(x => x + 1); }, 4000); return () => clearInterval(i); }, [load]);
  useEffect(() => { box.current?.scrollTo({ top: 1e6 }); }, [msgs.length]);
  const r = data?.request; const live = r && ['open', 'taken'].includes(r.status);
  async function send() { if (!text.trim()) return; setBusy(true); const x = await api('/api/onair', { action: 'message', id, text, t }); setBusy(false); if (x.ok) { setText(''); load(); } else setNote(x.j?.error || ''); }
  async function act(body: any) { setBusy(true); const x = await api('/api/onair', { ...body, id, t }); setBusy(false); if (x.ok) { if (x.j?.summary?.summary_ar) setSummary(x.j.summary.summary_ar); if (x.j?.note_ar) setNote(x.j.note_ar); load(); } else setNote(x.j?.error || ''); }
  const waitedSec = r ? Math.floor((Date.now() - Date.parse(r.created_at)) / 1000) : 0; void tick;
  const endsIn = r?.session_ends_at ? Math.max(0, Math.ceil((Date.parse(r.session_ends_at) - Date.now()) / 60000)) : null;
  return <div className="oa-thread" data-testid="oa-thread" data-status={r?.status || ''}>
    {onBack && <button type="button" className="ax-btn" onClick={onBack}>← {ar ? 'رجوع' : 'Back'}</button>}
    {!r && <p className="ax-muted">…</p>}
    {r && <>
      <p className="oa-status" role="status" data-testid="oa-status"><b>{r.kind_ar}</b> · <span className={`oa-st ${r.status}`}>{r.status_ar}</span>{r.bottle && <span className="oa-tag" data-testid="oa-bottle-tag">🍾 {BOTTLE_AR}</span>}{r.prefer_text && <span className="oa-tag">{ar ? 'نصّ' : 'text'}</span>}{r.org_scoped && <span className="oa-tag">{ar ? 'هواء الجهة' : 'org air'}</span>}{r.i_shadow && <span className="oa-tag shadow" data-testid="oa-shadow-tag">{ar ? 'ظلّ — تقرأ ولا تكتب' : 'shadow — read only'}</span>}
        {r.status === 'open' && r.kind !== 'consult' && !r.bottle && <small> · {ar ? `ننادي الحاضرين — ${Math.max(0, QUICK_TIMEOUT_MIN * 60 - waitedSec)} ث حتى نعرض البدائل` : `calling — ${Math.max(0, QUICK_TIMEOUT_MIN * 60 - waitedSec)} s`}</small>}
        {r.status === 'open' && r.bottle && <small> · {ar ? `تبقى ${BOTTLE_HOURS} ساعة — أول من يصعد يجدها` : `kept ${BOTTLE_HOURS} h`}</small>}
        {r.status === 'taken' && data.receiver && <small> · {ar ? 'معك:' : 'with you:'} <b>{data.receiver.name_ar}</b> ({data.receiver.face_ar})</small>}
        {endsIn !== null && r.status === 'taken' && <small> · {ar ? `تنتهي الجلسة بعد ${endsIn} د` : `session ends in ${endsIn} min`}</small>}
      </p>
      {r.status === 'taken' && r.room_code && <p className="oa-room"><Link href={`/room/${r.room_code}`} className="pt-btn navy small" data-testid="oa-room">{ar ? 'ادخل غرفة الجلسة' : 'Enter the session room'} · {r.room_code}</Link> {r.interpreter_wanted && <small>{ar ? '· طُلب مترجم إشارة' : '· interpreter requested'}</small>}</p>}
      {r.status === 'taken' && r.alt_link && <p className="oa-room"><a href={r.alt_link} target="_blank" rel="noopener noreferrer" className="pt-btn navy small" data-testid="oa-altlink">{ar ? 'انضم عبر رابط العضو' : 'Join via the member’s link'}</a></p>}
      {r.status === 'expired' && <div className="oa-alts" data-testid="oa-expired"><b>{ar ? 'لم يردّ أحد في الوقت — البدائل:' : 'Nobody answered — alternatives:'}</b><ul><li><Link href="/on-air">{ar ? 'نافذة قادمة' : 'Upcoming window'}</Link></li><li><Link href="/contact">{ar ? 'رسالة للطاقم' : 'Message staff'}</Link></li><li>{ar ? 'أثير (ذكاء اصطناعي — ليس إنسانًا)' : 'Athir (AI — not a human)'}</li></ul></div>}
      <div className="oa-msgs" ref={box} aria-live="polite">{msgs.map(m => <div key={m.id} className={`oa-m ${m.from_role}`}><span>{m.text_ar}</span><time>{new Date(m.created_at).toLocaleTimeString(ar ? 'ar-SA' : 'en', { hour: '2-digit', minute: '2-digit' })}</time></div>)}</div>
      {live && r.status === 'taken' && !r.i_shadow && <form className="oa-send" onSubmit={e => { e.preventDefault(); send(); }}><label className="oa-sr" htmlFor={`oa-in-${id}`}>{ar ? 'رسالة' : 'Message'}</label><input id={`oa-in-${id}`} value={text} onChange={e => setText(e.target.value.slice(0, 1000))} placeholder={ar ? 'اكتب…' : 'Type…'} data-testid="oa-msg" /><button type="submit" className="pt-btn navy small" disabled={busy || !text.trim()} data-testid="oa-msg-send">{ar ? 'أرسل' : 'Send'}</button></form>}
      {live && !r.i_shadow && <div className="ax-actions">
        {receiver && r.status === 'taken' && <>
          <button type="button" className="pt-btn gold small" disabled={busy} onClick={() => act({ action: 'close', outcome: 'solved' })} data-testid="oa-solved">{ar ? 'حُلّ' : 'Solved'}</button>
          <button type="button" className="pt-btn ghost small" disabled={busy} onClick={() => act({ action: 'close', outcome: 'needs_session' })}>{ar ? 'يحتاج جلسة' : 'Needs a session'}</button>
          <button type="button" className="pt-btn ghost small" disabled={busy} onClick={() => act({ action: 'close', outcome: 'needs_staff' })} data-testid="oa-escalate">{ar ? 'يحتاج الطاقم' : 'Needs staff'}</button>
          {r.kind === 'session' && !r.extended && <button type="button" className="pt-btn ghost small" disabled={busy} onClick={() => act({ action: 'extend' })} data-testid="oa-extend">{ar ? 'مدّد 10 دقائق' : 'Extend 10 min'}</button>}
        </>}
        {!receiver && <button type="button" className="pt-btn ghost small" disabled={busy} onClick={() => act({ action: 'cancel' })} data-testid="oa-cancel">{ar ? 'ألغِ الطلب' : 'Cancel'}</button>}
      </div>}
      {!live && !receiver && r.i_am === 'asker' && r.status === 'done' && <form className="oa-changed" onSubmit={e => { e.preventDefault(); act({ action: 'changed', what_changed: changed }); }}>
        <label className="ax-field">{ar ? 'ما الذي تغيّر؟ (بكلماتك — يقرؤه من ساعدك وحده)' : 'What changed? (your words — read only by who helped you)'}<textarea value={changed || r.what_changed_ar || ''} onChange={e => setChanged(e.target.value.slice(0, CHANGED_MAX))} rows={2} data-testid="oa-changed" /></label>
        <div className="ax-actions"><button type="submit" className="pt-btn navy small" disabled={busy || !changed.trim()} data-testid="oa-changed-send">{ar ? 'أرسل' : 'Send'}</button></div>
        <label className="oa-check"><input type="checkbox" checked={!!r.echo_ok} onChange={e => act({ action: 'echo_ok', ok: e.target.checked })} data-testid="oa-echo-ok" /> {ar ? 'أأذن أن يصبح سؤالي — مجهّلًا وبلا اسمي — «مهارةَ يوم» يتعلّم منها آخرون (صدى السؤال)' : 'My question may become an anonymized daily skill (Echo)'}</label>
      </form>}
      {receiver && r.what_changed_ar && <p className="oa-quote" data-testid="oa-quote">«{r.what_changed_ar}»</p>}
      {summary && <div className="oa-sum" data-testid="oa-summary"><b>{ar ? 'تلخيص للمُستقبِل (ذكاء اصطناعي — لا يُحفظ)' : 'Summary (AI — not saved)'}</b><p>{summary}</p></div>}
      {note && <p className="ax-msg" role="status">{note}</p>}
    </>}
  </div>;
}

export const ONAIR_CSS = `
.oa-btn{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;border:1.5px solid #cbd5e1;background:#fff;color:#0f2a4e;border-radius:999px;padding:7px 12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;min-height:36px;position:relative}
.oa-btn b{background:#0f2a4e;color:#fff;border-radius:999px;padding:0 7px;font-size:11px;line-height:18px}.oa-btn.live{border-color:#b45309;background:#fffbeb}.oa-btn.live b{background:#b45309}
.oa-dot{width:9px;height:9px;border-radius:50%;background:#94a3b8;flex:0 0 auto}.oa-btn.live .oa-dot{background:#dc2626;box-shadow:0 0 0 0 rgba(220,38,38,.5);animation:oaPulse 1.6s infinite}
@keyframes oaPulse{0%{box-shadow:0 0 0 0 rgba(220,38,38,.45)}70%{box-shadow:0 0 0 8px rgba(220,38,38,0)}100%{box-shadow:0 0 0 0 rgba(220,38,38,0)}}
.oa-line{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:12px 0 0;color:#334155;font-size:14px}.oa-line b{color:#0f2a4e;font-size:16px}.oa-line .oa-dot.on{background:#dc2626;animation:oaPulse 1.6s infinite}
.oa-linebtn{border:0;background:#0f2a4e;color:#fff;border-radius:999px;padding:8px 14px;font:inherit;font-weight:800;cursor:pointer;min-height:40px}
.oa-hand{margin-inline-start:2px;font-size:14px}.oa-golden{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0 0;color:#92400e;background:#fffbeb;border-radius:10px;padding:6px 10px;font-size:13.5px}.oa-golden b{color:#78350f}.oa-golden a{color:#0b6f69;font-weight:800}
.oa-tag{display:inline-block;background:#f1f5f9;color:#0f2a4e;border-radius:999px;padding:1px 8px;font-size:12px;font-weight:800;margin-inline-start:6px}.oa-tag.shadow{background:#ede9fe;color:#5b21b6}.oa-bottle{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 0}.oa-bottle small{color:#475569}
.oa-map{margin:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:10px}.oa-map svg{width:100%;max-height:340px;display:block}.oa-map.compact svg{max-height:160px}.oa-map-land{fill:#e2e8f0;stroke:#cbd5e1;stroke-width:.6}.oa-map-city{fill:#94a3b8}.oa-map-dot{fill:#dc2626}.oa-map-pulse{fill:rgba(220,38,38,.18);animation:oaMap 2s infinite}.oa-map-lbl{font-size:3.4px;fill:#0f2a4e;font-weight:700;direction:rtl}.oa-map figcaption{margin:6px 0 0;color:#334155;font-size:13.5px}
@keyframes oaMap{0%{opacity:.9}50%{opacity:.3}100%{opacity:.9}}html[data-access~="focus"] .oa-map-pulse{animation:none}
.oa-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.oa-panel{width:min(720px,100%)}.oa-live{display:inline-block;background:#fffbeb;color:#92400e;border-radius:999px;padding:2px 10px;font-weight:800;font-size:13px;margin-inline-start:6px}
.oa-grades{list-style:none;margin:0 0 14px;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}
.oa-grade{width:100%;text-align:start;border:1.5px solid #e2e8f0;border-radius:14px;padding:12px;background:#fff;font:inherit;cursor:pointer;min-height:44px;display:flex;flex-direction:column;gap:4px;color:#0f2a4e}.oa-grade:hover{border-color:#0b6f69;background:#f0fbfa}
.oa-grade b{font-size:16px}.oa-grade small{color:#475569;line-height:1.6;font-weight:400}.oa-n{align-self:flex-start;background:#f1f5f9;border-radius:999px;padding:1px 8px;font-size:12px;font-weight:800;color:#0b6f69}
.oa-h{margin:12px 0 6px;font-size:15px;color:#0f2a4e}.oa-people,.oa-wins{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.oa-people li{display:flex;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px}.oa-people b{display:block;color:#0f2a4e}.oa-people small{color:#475569;display:block;line-height:1.6}
.oa-ava{width:40px;height:40px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 auto;color:#0b6f69}.oa-ava img{width:100%;height:100%;object-fit:cover}
.oa-link{font-size:12.5px;color:#0b6f69;font-weight:800;margin-inline-start:6px}.oa-wins li{color:#334155}.oa-wins small{color:#475569}
.oa-pick{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 6px}.oa-pick small{color:#475569}.oa-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:560px){.oa-row{grid-template-columns:1fr}}
.oa-form select{display:block;width:100%;margin-top:6px;border:1.5px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;min-height:44px;background:#fff}
.oa-check{display:flex;align-items:center;gap:8px;margin-top:10px;color:#0f2a4e;min-height:44px}.oa-check input{width:20px;height:20px;accent-color:#0b6f69}
.oa-warn{background:#fffbeb;color:#92400e;border-radius:10px;padding:8px 12px;margin:8px 0 0;font-size:13.5px}.oa-err{color:#b91c1c;font-weight:800;margin:8px 0 0}
.oa-alts{background:#f8fafc;border-radius:12px;padding:10px 14px;margin:10px 0 0;color:#334155}.oa-alts ul{margin:6px 0 0;padding-inline-start:18px}
.oa-thread{display:grid;gap:10px}.oa-status{margin:0;color:#334155}.oa-st{font-weight:800;color:#0f2a4e}.oa-st.open{color:#92400e}.oa-st.taken{color:#0b6f69}.oa-st.expired,.oa-st.cancelled{color:#b91c1c}
.oa-room{margin:0}.oa-msgs{max-height:300px;overflow:auto;display:grid;gap:6px;background:#f8fafc;border-radius:12px;padding:10px;min-height:60px}
.oa-m{display:flex;flex-direction:column;max-width:85%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px;color:#0f2a4e}.oa-m.receiver{align-self:flex-start;border-color:#0b6f69;background:#f0fbfa}.oa-m.asker{align-self:flex-end}.oa-m.system{align-self:center;background:#fffbeb;border-color:#fde68a;color:#92400e;font-size:13px}
.oa-m time{font-size:11px;color:#64748b;margin-top:2px}.oa-send{display:flex;gap:8px}.oa-send input{flex:1;border:1.5px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;min-height:44px}
.oa-quote{margin:0;color:#0b6f69;font-weight:800}.oa-sum{background:#f8fafc;border-radius:12px;padding:10px 12px;color:#334155}.oa-sum p{margin:4px 0 0;white-space:pre-wrap}
html[data-access~="focus"] .oa-btn.live .oa-dot{animation:none}
`;
