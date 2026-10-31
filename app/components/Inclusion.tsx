'use client';

// P32 «أَثَر للجميع» — «أَثَر على مقاسي»: مزوّد الاحتياجات + لوحة التكييف + «اقرأ لي الصفحة» + «نسخة أبسط» + الترجمة الحيّة
// الاحتياجات تُطبَّق سمةً على <html data-access="…"> فيقرؤها CSS الغلاف؛ لا تُرسل إلى أي نموذج ذكاء اصطناعي.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase/client';
import { fastToken } from './Pocket';
import { Icon } from '../../lib/ui/icons';
import { ACCESS_STORAGE_KEY, NEEDS, NEED_LABEL, NEED_EFFECT_AR, cleanNeeds, accessAttr, CAPTION_LANG, CAPTION_TTL_MS, mergeCaption } from '../../lib/inclusion/registry';
import type { Need, SimpleSource, SimpleText, CaptionMsg } from '../../lib/inclusion/registry';

type Lang = 'ar' | 'en';
type Ctx = { needs: Need[]; has: (n: Need) => boolean; setNeeds: (n: Need[]) => void; saveToAccount: (n: Need[], extra?: { helps_ar?: string; share_staff?: boolean }) => Promise<string | null>; signedIn: boolean; synced: boolean; open: boolean; setOpen: (o: boolean, tab?: 'needs' | 'report') => void; tab: 'needs' | 'report' };
const AccessCtx = createContext<Ctx>({ needs: [], has: () => false, setNeeds: () => {}, saveToAccount: async () => null, signedIn: false, synced: false, open: false, setOpen: () => {}, tab: 'needs' });
export const useAccess = () => useContext(AccessCtx);

const readLocal = (): Need[] => { try { return cleanNeeds(JSON.parse(localStorage.getItem(ACCESS_STORAGE_KEY) || '[]')); } catch { return []; } };
const writeLocal = (n: Need[]) => { try { localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(n)); } catch { /* ignore */ } };
const applyAttr = (n: Need[]) => { try { const v = accessAttr(n); if (v) document.documentElement.setAttribute('data-access', v); else document.documentElement.removeAttribute('data-access'); } catch { /* ignore */ } };

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const [needs, setNeedsState] = useState<Need[]>([]); const [signedIn, setSignedIn] = useState(false); const [synced, setSynced] = useState(false);
  const [open, setOpenState] = useState(false); const [tab, setTab] = useState<'needs' | 'report'>('needs');
  useEffect(() => {
    const local = readLocal(); setNeedsState(local); applyAttr(local);
    (async () => {
      try {
        const tk = await fastToken(supabase()); if (!tk) { setSynced(true); return; } setSignedIn(true);
        const r = await fetch('/api/inclusion?mine=1', { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(x => x.json()).catch(() => null);
        if (r?.success && r.profile) { const n = cleanNeeds(r.profile.needs); setNeedsState(n); writeLocal(n); applyAttr(n); }
      } catch { /* يبقى المحلي */ }
      setSynced(true);
    })();
  }, []);
  const setNeeds = useCallback((n: Need[]) => { const c = cleanNeeds(n); setNeedsState(c); writeLocal(c); applyAttr(c); }, []);
  const saveToAccount = useCallback(async (n: Need[], extra?: { helps_ar?: string; share_staff?: boolean }) => {
    try {
      const tk = await fastToken(supabase()); if (!tk) return 'سجّل الدخول لحفظ ملفك في حسابك';
      const r = await fetch('/api/inclusion', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ action: 'save', needs: n, ...(extra || {}) }) }).then(x => x.json());
      if (!r?.success) return r?.error || 'تعذّر الحفظ'; setNeeds(cleanNeeds(r.profile?.needs)); return null;
    } catch { return 'تعذّر الاتصال'; }
  }, [setNeeds]);
  const setOpen = useCallback((o: boolean, t?: 'needs' | 'report') => { if (t) setTab(t); setOpenState(o); }, []);
  const value = useMemo<Ctx>(() => ({ needs, has: n => needs.includes(n), setNeeds, saveToAccount, signedIn, synced, open, setOpen, tab }), [needs, setNeeds, saveToAccount, signedIn, synced, open, setOpen, tab]);
  return <AccessCtx.Provider value={value}>{children}</AccessCtx.Provider>;
}

/** رابط «تخطَّ إلى المحتوى» — أول عنصر قابل للتركيز في كل صفحة */
const SKIP_CSS = `.ax-skip{position:absolute;top:-100px;inset-inline-start:8px;z-index:10000;background:#0f2a4e;color:#fff;padding:10px 16px;border-radius:0 0 10px 10px;font-weight:800;text-decoration:none;font-size:15px}.ax-skip:focus{top:0;outline:3px solid #c9a24b;outline-offset:2px}`;
// رابط التخطّي: أول عنصر يصل إليه Tab في كل صفحة (يحمل أنماطه معه ليعمل خارج PortalShell أيضًا — الشريط العام/الإداري)
export function SkipLink({ lang }: { lang: Lang }) {
  return <><style dangerouslySetInnerHTML={{ __html: SKIP_CSS }} /><a href="#main" className="ax-skip" onClick={e => { e.preventDefault(); const m = document.querySelector('main') as HTMLElement | null; if (m) { m.setAttribute('tabindex', '-1'); m.focus(); m.scrollIntoView(); } }}>{lang === 'ar' ? 'تخطَّ إلى المحتوى' : 'Skip to content'}</a></>;
}

/** زر الرأس «على مقاسي» */
export function AccessButton({ lang }: { lang: Lang }) {
  const a = useAccess(); const n = a.needs.length;
  return <button type="button" className={`ax-btn ${n ? 'on' : ''}`} onClick={() => a.setOpen(true, 'needs')} aria-haspopup="dialog" aria-expanded={a.open} data-testid="ax-open" title={lang === 'ar' ? 'أَثَر على مقاسي — كيّف البوابة لاحتياجك' : 'Athar, my way — adapt the portal to you'}>
    <Icon name="users" size={15} /> {lang === 'ar' ? 'على مقاسي' : 'My way'}{n ? <b aria-hidden="true">{n}</b> : null}
  </button>;
}

/** لوحة «أَثَر على مقاسي» — حوار بتركيز محصور وإغلاق بـ Esc؛ تبويبان: احتياجاتي · أخبرنا بعائق */
export function AccessPanel({ lang }: { lang: Lang }) {
  const a = useAccess(); const ar = lang === 'ar'; const ref = useRef<HTMLDivElement>(null); const last = useRef<HTMLElement | null>(null);
  const [draft, setDraft] = useState<Need[]>(a.needs); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const [rep, setRep] = useState({ text: '', contact: '' }); const [repMsg, setRepMsg] = useState('');
  useEffect(() => { if (a.open) { setDraft(a.needs); setMsg(''); setRepMsg(''); last.current = document.activeElement as HTMLElement; setTimeout(() => ref.current?.querySelector<HTMLElement>('button,input,[tabindex]')?.focus(), 30); } else last.current?.focus?.(); }, [a.open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!a.open) return; const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { a.setOpen(false); return; }
      if (e.key === 'Tab' && ref.current) { const f = Array.from(ref.current.querySelectorAll<HTMLElement>('button,input,textarea,a[href],[tabindex]:not([tabindex="-1"])')).filter(x => !x.hasAttribute('disabled')); if (!f.length) return; const i = f.indexOf(document.activeElement as HTMLElement); if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
    }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [a.open, a]);
  if (!a.open) return null;
  const toggle = (n: Need) => setDraft(d => (d.includes(n) ? d.filter(x => x !== n) : [...d, n]));
  const applyLocal = () => { a.setNeeds(draft); setMsg(ar ? 'طُبِّق على هذا الجهاز.' : 'Applied on this device.'); };
  const save = async () => { setBusy(true); a.setNeeds(draft); const err = await a.saveToAccount(draft); setBusy(false); setMsg(err || (ar ? 'حُفظ في حسابك — يتبعك على كل جهاز.' : 'Saved to your account.')); };
  const sendReport = async () => {
    setBusy(true); setRepMsg('');
    try { const tk = await fastToken(supabase()).catch(() => ''); const r = await fetch('/api/inclusion', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }, body: JSON.stringify({ action: 'report', page: location.pathname, text: rep.text, contact: rep.contact || undefined }) }).then(x => x.json()); setRepMsg(r?.success ? r.message_ar : (r?.error || 'تعذّر الإرسال')); if (r?.success) setRep({ text: '', contact: '' }); } catch { setRepMsg('تعذّر الاتصال'); }
    setBusy(false);
  };
  return (
    <div className="ax-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) a.setOpen(false); }}>
      <div className="ax-panel" role="dialog" aria-modal="true" aria-labelledby="ax-title" ref={ref} dir={ar ? 'rtl' : 'ltr'} data-testid="ax-panel">
        <header className="ax-head"><h2 id="ax-title"><Icon name="users" size={18} /> {ar ? 'أَثَر على مقاسي' : 'Athar, my way'}</h2><button type="button" className="ax-x" onClick={() => a.setOpen(false)} aria-label={ar ? 'إغلاق' : 'Close'}>✕</button></header>
        <div className="ax-tabs" role="tablist"><button type="button" role="tab" aria-selected={a.tab === 'needs'} className={a.tab === 'needs' ? 'on' : ''} onClick={() => a.setOpen(true, 'needs')}>{ar ? 'ما يساعدني' : 'What helps me'}</button><button type="button" role="tab" aria-selected={a.tab === 'report'} className={a.tab === 'report' ? 'on' : ''} onClick={() => a.setOpen(true, 'report')}>{ar ? 'أخبرنا بعائق' : 'Report a barrier'}</button></div>
        {a.tab === 'needs' ? <div className="ax-body">
          <p className="ax-lead">{ar ? 'اختر ما ينطبق عليك بكلماتك — لا نسأل عن سبب ولا نطلب وثيقة. البوابة تتكيّف فورًا، وأنت وحدك ترى هذه القائمة.' : 'Pick what applies, in your words — no reasons, no documents. The portal adapts at once; only you see this list.'}</p>
          <ul className="ax-needs">{NEEDS.map(n => <li key={n}><label><input type="checkbox" checked={draft.includes(n)} onChange={() => toggle(n)} data-testid={`ax-need-${n}`} /><span><b>{NEED_LABEL[n][lang]}</b><small>{NEED_EFFECT_AR[n]}</small></span></label></li>)}</ul>
          <div className="ax-actions">
            <button type="button" className="pt-btn navy" onClick={applyLocal} data-testid="ax-apply">{ar ? 'طبّق على هذا الجهاز' : 'Apply on this device'}</button>
            {a.signedIn ? <button type="button" className="pt-btn gold" onClick={save} disabled={busy} data-testid="ax-save">{ar ? 'احفظ في حسابي' : 'Save to my account'}</button> : <Link href="/me/access" className="pt-btn ghost">{ar ? 'احفظه في حسابي (دخول)' : 'Save to account (sign in)'}</Link>}
            {draft.length > 0 && <button type="button" className="pt-btn ghost small" onClick={() => setDraft([])}>{ar ? 'امسح الكل' : 'Clear'}</button>}
          </div>
          {msg && <p className="ax-msg" role="status" data-testid="ax-msg">{msg}</p>}
          <p className="ax-foot"><Link href="/me/access">{ar ? 'ملفي الكامل («ما يساعدني» ومشاركته مع الطاقم)' : 'My full profile'}</Link> · <Link href="/accessibility">{ar ? 'بيان الوصول' : 'Accessibility statement'}</Link></p>
        </div> : <div className="ax-body">
          <p className="ax-lead">{ar ? 'شيء لم يعمل معك؟ زر لا يُقرأ، لون لا يُرى، خطوة لم تفهمها. اكتبه كما هو — نقرؤه بأنفسنا.' : 'Something did not work for you? Tell us as it is — we read it ourselves.'}</p>
          <label className="ax-field">{ar ? 'ما العائق؟' : 'What was the barrier?'}<textarea rows={4} value={rep.text} onChange={e => setRep(r => ({ ...r, text: e.target.value }))} maxLength={2000} data-testid="ax-report-text" /></label>
          <label className="ax-field">{ar ? 'بريد للرد (اختياري)' : 'Email for a reply (optional)'}<input type="email" value={rep.contact} onChange={e => setRep(r => ({ ...r, contact: e.target.value }))} /></label>
          <p className="ax-muted">{ar ? `الصفحة: ${typeof location !== 'undefined' ? location.pathname : ''}` : ''}</p>
          <div className="ax-actions"><button type="button" className="pt-btn gold" onClick={sendReport} disabled={busy || rep.text.trim().length < 5} data-testid="ax-report-send">{ar ? 'أرسل البلاغ' : 'Send'}</button></div>
          {repMsg && <p className="ax-msg" role="status" data-testid="ax-report-msg">{repMsg}</p>}
        </div>}
      </div>
    </div>
  );
}

/** «اقرأ لي الصفحة» — يظهر لمن أعلن «أرى بصعوبة» أو «أقرأ بصعوبة»؛ يقرأ نص <main> */
export function ReadPage({ lang }: { lang: Lang }) {
  const a = useAccess(); const [on, setOn] = useState(false); const [can, setCan] = useState(false);
  useEffect(() => { setCan(typeof window !== 'undefined' && 'speechSynthesis' in window); return () => { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }; }, []);
  if (!can || !(a.has('low_vision') || a.has('read_hard'))) return null;
  const toggle = () => {
    try {
      if (on) { window.speechSynthesis.cancel(); setOn(false); return; }
      const m = document.querySelector('main'); const text = (m?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 6000); if (!text) return;
      window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'ar' ? 'ar-SA' : 'en-GB'; u.rate = 0.95; u.onend = () => setOn(false); u.onerror = () => setOn(false); window.speechSynthesis.speak(u); setOn(true);
    } catch { setOn(false); }
  };
  return <button type="button" className={`ax-read ${on ? 'on' : ''}`} onClick={toggle} aria-pressed={on} data-testid="ax-readpage">{on ? (lang === 'ar' ? '⏹ أوقف القراءة' : '⏹ Stop') : (lang === 'ar' ? '🔊 اقرأ لي الصفحة' : '🔊 Read this page')}</button>;
}

/** «نسخة أبسط» — تُعرض المعتمَدة فقط؛ الطلب يولّد نسخة pending يعتمدها الطاقم. تظهر تلقائيًا لمن أعلن «أحتاج لغة أبسط» */
export function SimplerText({ source, id, lang, children }: { source: SimpleSource; id: string; lang: Lang; children?: React.ReactNode }) {
  const a = useAccess(); const ar = lang === 'ar'; const [t, setT] = useState<SimpleText | null>(null); const [show, setShow] = useState(false); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [checked, setChecked] = useState(false);
  const auto = a.has('simple') || a.has('read_hard');
  const load = useCallback(async () => { try { const r = await fetch(`/api/inclusion?simple=${source}&id=${encodeURIComponent(id)}`, { cache: 'no-store' }).then(x => x.json()); if (r?.success) { setT(r.text || null); if (r.pending) setNote(ar ? 'نسخة أبسط بانتظار اعتماد الطاقم.' : 'A simpler version awaits staff approval.'); return r; } } catch { /* ignore */ } return null; }, [source, id, ar]);
  useEffect(() => { if (auto && !checked) { setChecked(true); load().then(r => { if (r?.text) setShow(true); }); } }, [auto, checked, load]);
  const click = async () => {
    if (t) { setShow(s => !s); return; }
    setBusy(true); const r = await load();
    if (r?.text) { setShow(true); setBusy(false); return; }
    if (r?.pending) { setBusy(false); return; }
    try {
      const tk = await fastToken(supabase()).catch(() => ''); if (!tk) { setNote(ar ? 'سجّل الدخول لطلب نسخة أبسط — تُكتب مرة واحدة ويقرؤها الجميع بعد اعتمادها.' : 'Sign in to request a simpler version.'); setBusy(false); return; }
      const x = await fetch('/api/inclusion', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ action: 'simplify', source, id }) }).then(y => y.json());
      setNote(x?.success ? (x.note_ar || '') : (x?.error || 'تعذّر الطلب')); if (x?.success && x.text) { setT(x.text); setShow(true); }
    } catch { setNote('تعذّر الاتصال'); }
    setBusy(false);
  };
  return <div className="ax-simple" data-testid={`ax-simple-${source}`}>
    <button type="button" className={`ax-simple-btn ${show ? 'on' : ''}`} onClick={click} disabled={busy} aria-expanded={show} data-testid="ax-simple-btn">{ar ? (show ? 'النص الأصلي' : 'نسخة أبسط') : (show ? 'Original' : 'Simpler version')}</button>
    {show && t ? <div className="ax-simple-text" lang="ar" dir="rtl" data-testid="ax-simple-text">{t.simple_ar.split('\n').map((l, i) => <p key={i}>{l}</p>)}<small>{ar ? 'نسخة أبسط كتبها الذكاء الاصطناعي واعتمدها الطاقم — المعنى نفسه بكلمات أقل' : 'Simpler version written by AI and approved by staff'}</small></div> : children}
    {note && <p className="ax-muted" role="status" data-testid="ax-simple-note">{note}</p>}
  </div>;
}

/** الترجمة الحيّة — المتكلّم: تعرّف الكلام في متصفحه يبثّ سطورًا نصّية على قناة الغرفة؛ لا صوت يغادر الجهاز إلى أي خادم */
type Recog = any;
export function useCaptionSpeaker(opts: { lang: Lang; me: string; name: string; send: (m: CaptionMsg) => void }) {
  const [supported, setSupported] = useState(false); const [on, setOn] = useState(false); const rec = useRef<Recog>(null); const wantOn = useRef(false);
  useEffect(() => { const w = globalThis as any; setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition)); }, []);
  const stop = useCallback(() => { wantOn.current = false; try { rec.current?.stop(); } catch { /* ignore */ } rec.current = null; setOn(false); }, []);
  const start = useCallback(() => {
    const w = globalThis as any; const R = w.SpeechRecognition || w.webkitSpeechRecognition; if (!R) return;
    try {
      const r = new R(); r.lang = CAPTION_LANG[opts.lang]; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
      r.onresult = (e: any) => { let text = ''; let final = false; for (let i = e.resultIndex; i < e.results.length; i++) { text += e.results[i][0].transcript; if (e.results[i].isFinal) final = true; } text = text.trim(); if (text) opts.send({ type: 'caption', from: opts.me, name: opts.name, text: text.slice(0, 300), final, at: Date.now() }); };
      r.onend = () => { if (wantOn.current) { try { r.start(); } catch { setOn(false); } } };
      r.onerror = (e: any) => { if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') stop(); };
      wantOn.current = true; r.start(); rec.current = r; setOn(true);
    } catch { setOn(false); }
  }, [opts, stop]);
  useEffect(() => () => { wantOn.current = false; try { rec.current?.stop(); } catch { /* ignore */ } }, []);
  return { supported, on, toggle: () => (on ? stop() : start()) };
}
/** لوح الترجمة الحيّة للمشاهد — سطر لكل متكلّم، يختفي بعد 7 ثوانٍ */
export function useCaptionBoard() {
  const [lines, setLines] = useState<CaptionMsg[]>([]);
  const push = useCallback((m: CaptionMsg) => setLines(ls => mergeCaption(ls, m)), []);
  useEffect(() => { const t = setInterval(() => setLines(ls => { const now = Date.now(); const alive = ls.filter(l => now - l.at < CAPTION_TTL_MS); return alive.length === ls.length ? ls : alive; }), 1000); return () => clearInterval(t); }, []);
  return { lines, push, clear: () => setLines([]) };
}
export function CaptionBoard({ lines, lang }: { lines: CaptionMsg[]; lang: Lang }) {
  return <div className="ax-captions" role="region" aria-live="polite" aria-atomic="false" aria-label={lang === 'ar' ? 'الترجمة الحيّة' : 'Live captions'} data-testid="ax-captions">
    {lines.length === 0 ? <span className="ax-cap-empty">{lang === 'ar' ? 'الترجمة الحيّة تعمل — تظهر الكلمات هنا عندما يتكلّم من شغّلها' : 'Live captions on — words appear when a speaker enables them'}</span> : lines.map(l => <p key={l.from} className={l.final ? 'final' : 'interim'}><b>{l.name || '…'}:</b> {l.text}</p>)}
  </div>;
}

/** CSS التكييف — يُحقن مرة واحدة من الغلاف؛ يقرأ data-access على <html> */
export const ACCESS_CSS = `
.ax-btn{display:inline-flex;align-items:center;gap:6px;border:1.5px solid #cbd5e1;background:#fff;color:#0f2a4e;border-radius:999px;padding:7px 12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;min-height:36px}
.ax-btn.on{border-color:#0b6f69;background:#e6f4f3}.ax-btn b{background:#0b6f69;color:#fff;border-radius:999px;padding:0 7px;font-size:11px;line-height:18px}
.ax-backdrop{position:fixed;inset:0;background:rgba(15,42,78,.45);z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto}
.ax-panel{background:#fff;border-radius:18px;width:min(640px,100%);box-shadow:0 30px 80px rgba(0,0,0,.3);max-height:92vh;overflow:auto}
.ax-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #e2e8f0}.ax-head h2{margin:0;font-size:18px;display:flex;align-items:center;gap:8px;color:#0f2a4e}
.ax-x{border:0;background:#f1f5f9;border-radius:10px;width:40px;height:40px;font-size:16px;cursor:pointer;color:#0f2a4e}
.ax-tabs{display:flex;gap:6px;padding:10px 20px 0}.ax-tabs button{border:0;background:#f1f5f9;border-radius:10px 10px 0 0;padding:10px 14px;font:inherit;font-weight:800;cursor:pointer;color:#334155;min-height:44px}.ax-tabs button.on{background:#0f2a4e;color:#fff}
.ax-body{padding:14px 20px 20px}.ax-lead{margin:0 0 12px;color:#334155;line-height:1.8}
.ax-needs{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}
.ax-needs label{display:flex;gap:10px;align-items:flex-start;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px 12px;cursor:pointer;min-height:44px}.ax-needs label:has(input:checked){border-color:#0b6f69;background:#f0fbfa}
.ax-needs input{width:22px;height:22px;margin-top:2px;flex:0 0 auto;accent-color:#0b6f69}.ax-needs b{display:block;color:#0f2a4e}.ax-needs small{display:block;color:#475569;line-height:1.6;margin-top:2px}
.ax-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.ax-msg{margin:10px 0 0;color:#0b6f69;font-weight:800}.ax-foot{margin:12px 0 0;font-size:13px;color:#475569}.ax-muted{color:#475569;font-size:13px;margin:8px 0 0}
.ax-field{display:block;margin-top:10px;font-weight:800;color:#0f2a4e}.ax-field textarea,.ax-field input{display:block;width:100%;margin-top:6px;border:1.5px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-weight:400;min-height:44px}
.ax-read{position:fixed;bottom:88px;inset-inline-start:16px;z-index:800;border:0;border-radius:999px;background:#0f2a4e;color:#fff;font:inherit;font-weight:800;padding:12px 18px;box-shadow:0 10px 30px rgba(15,42,78,.35);cursor:pointer;min-height:44px}.ax-read.on{background:#0b6f69}
.ax-simple{margin:6px 0}.ax-simple-btn{border:1.5px dashed #0b6f69;background:#fff;color:#0b6f69;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;min-height:36px}.ax-simple-btn.on{background:#0b6f69;color:#fff;border-style:solid}
.ax-simple-text{background:#f0fbfa;border:1px solid #cdebe8;border-radius:12px;padding:12px 16px;margin-top:8px;font-size:17px;line-height:2}.ax-simple-text p{margin:0 0 6px}.ax-simple-text small{display:block;color:#475569;font-size:12px;margin-top:6px;line-height:1.6}
.ax-captions{position:absolute;inset-inline:12px;bottom:12px;background:rgba(0,0,0,.78);color:#fff;border-radius:12px;padding:10px 14px;font-size:18px;line-height:1.7;min-height:44px;z-index:5;pointer-events:none}.ax-captions p{margin:0}.ax-captions .interim{opacity:.75}.ax-cap-empty{opacity:.7;font-size:14px}
html[data-access~="low_vision"] .pt{zoom:1.25}
html[data-access~="low_vision"] .pt,html[data-access~="low_vision"] .pt *{text-shadow:none}
html[data-access~="low_vision"] .pt .pt-muted,html[data-access~="low_vision"] .pt small,html[data-access~="low_vision"] .pt .ax-muted{color:#1e293b!important}
html[data-access~="low_vision"] :focus-visible,html[data-access~="motor"] :focus-visible{outline:4px solid #0f2a4e!important;outline-offset:3px!important;box-shadow:0 0 0 7px #fde68a!important}
html[data-access~="read_hard"] .pt{line-height:2.05;letter-spacing:.01em;word-spacing:.08em}html[data-access~="read_hard"] .pt p,html[data-access~="read_hard"] .pt li{max-width:68ch}
html[data-access~="motor"] .pt button,html[data-access~="motor"] .pt a.pt-btn,html[data-access~="motor"] .pt input,html[data-access~="motor"] .pt select,html[data-access~="motor"] .pt .pt-navlink{min-height:44px;min-width:44px;padding-top:10px;padding-bottom:10px}
html[data-access~="focus"] *,html[data-access~="focus"] *::before,html[data-access~="focus"] *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
html[data-access~="focus"] .at-peek,html[data-access~="low_bandwidth"] video[autoplay]{display:none!important}
html[data-access~="hard_hearing"] .pt .ch-voice-first{display:none}
`;
