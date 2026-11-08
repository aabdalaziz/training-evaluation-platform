'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /enter?o=<slug> — P67 «الاسم يدخل من الباب»: باب الدخول بالرمز (بلا بريد) — ثنائي اللغة، للجوّال والكشك
 *  الرقم التدريبي + رقم سري من 6 → جلسة · أول دخول: «ميثاق الرمز» (ما نعرفه وما لا نعرفه) + ★4 كُنية من قائمة مغلقة · ثم /me
 *  رقم سري غير مُغيَّر → اقتراح تغييره (اختياري) · القفل بعد 5 محاولات برسالة إنسانية · لا أسماء ولا بريد في أي موضع
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase/client';
import { EPITHETS } from '../../lib/org/epithets';

type Org = { name_ar: string; name_en: string | null; slug: string; code_login: boolean; kiosk_minutes: number; frozen: boolean };
type Lang = 'ar' | 'en';
const T = {
  ar: { title: 'ادخل برمزك', sub: 'رقمك التدريبي ورقمك السرّي — لا بريد ولا اسم', no: 'الرقم التدريبي', pin: 'الرقم السرّي (6 أرقام)', go: 'ادخل', busy: '…', orgQ: 'ما مُعرِّف جهتك؟', orgHint: 'هو الجزء بعد ?o= في الرابط الذي أعطتك إياه جهتك', orgGo: 'تابع',
    charterT: 'ميثاق الرمز', charter: ['أنت هنا رقم تدريبي — لا نعرف اسمك ولا بريدك، وجهتك وحدها تملك جدول الرقم ↔ الشخص.', 'كل ما تكتبه في أَثَر يُنسب إلى رقمك، ويراه مشرفك في جهتك فقط. لا شيء منه يُنشر باسمك.', 'ما تقرأه عن أثرك لا يدخل في أي تقييم أو ترقية — هو لك لتتقدّم.', 'يمكنك تغيير رقمك السرّي في أي وقت، وإن نسيته فمشرفك يعيد تعيينه.'],
    agree: 'فهمت — ادخل', nickT: 'ماذا نناديك هنا؟ (اختياري)', nickHint: 'كُنية من القائمة — لا نكتب الأسماء', nickNone: 'ناديني برقمي', nickSave: 'حفظ ومتابعة', skip: 'تخطّ',
    pinT: 'رقمك السرّي ما زال كما أعطتك جهتك', pinHint: 'غيّره الآن ليكون لك وحدك (اختياري)', cur: 'الحالي', nxt: 'الجديد (6 أرقام)', change: 'غيّر', later: 'لاحقًا', changed: 'تغيّر رقمك السرّي ✓',
    locked: 'أُغلق هذا الرمز مؤقتًا', tryAt: 'حاول بعد', min: 'دقيقة', remain: 'محاولات متبقية', notCode: 'هذه الجهة تدخل من /login', frozen: 'جهتك في وضع القراءة فقط مؤقتًا', noOrg: 'لا توجد جهة بهذا المُعرِّف', kiosk: 'وضع الكشك: الخروج التلقائي بعد', home: 'الرئيسية', login: 'الدخول بالبريد', help: 'نسيت رقمك السرّي؟ اطلب من مشرفك في جهتك إعادة تعيينه.' },
  en: { title: 'Enter with your code', sub: 'Your training number and PIN — no email, no name', no: 'Training number', pin: 'PIN (6 digits)', go: 'Enter', busy: '…', orgQ: 'Your organization identifier?', orgHint: 'The part after ?o= in the link your organization gave you', orgGo: 'Continue',
    charterT: 'The code charter', charter: ['Here you are a training number — we do not know your name or email; only your organization holds the number ↔ person table.', 'Everything you write is attributed to your number and seen only by your supervisor in your organization. Nothing is published under your name.', 'What you read about your impact never enters any evaluation or promotion — it is yours, to move forward.', 'You can change your PIN anytime; if you forget it, your supervisor resets it.'],
    agree: 'Understood — enter', nickT: 'What shall we call you here? (optional)', nickHint: 'An epithet from the list — no names', nickNone: 'Call me by my number', nickSave: 'Save & continue', skip: 'Skip',
    pinT: 'Your PIN is still the one your organization gave you', pinHint: 'Change it now so it is yours alone (optional)', cur: 'Current', nxt: 'New (6 digits)', change: 'Change', later: 'Later', changed: 'PIN changed ✓',
    locked: 'This code is temporarily locked', tryAt: 'Try after', min: 'min', remain: 'attempts left', notCode: 'This organization signs in at /login', frozen: 'Your organization is read-only for now', noOrg: 'No organization with this identifier', kiosk: 'Kiosk mode: auto sign-out after', home: 'Home', login: 'Sign in with email', help: 'Forgot your PIN? Ask your supervisor to reset it.' },
};

export default function EnterPage() {
  const [lang, setLang] = useState<Lang>('ar'); const t = T[lang];
  const [slug, setSlug] = useState(''); const [org, setOrg] = useState<Org | null>(null); const [orgErr, setOrgErr] = useState('');
  const [no, setNo] = useState(''); const [pin, setPin] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [lockedUntil, setLockedUntil] = useState<string | null>(null); const [remaining, setRemaining] = useState<number | null>(null);
  const [step, setStep] = useState<'org' | 'login' | 'charter' | 'nick' | 'pin' | 'done'>('org'); const [token, setToken] = useState(''); const [first, setFirst] = useState(false); const [pinChanged, setPinChanged] = useState(true);
  const [nick, setNick] = useState('none'); const [cur, setCur] = useState(''); const [nxt, setNxt] = useState(''); const [note, setNote] = useState('');
  const noRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search); const o = (sp.get('o') || '').trim().toLowerCase(); if (sp.get('lang') === 'en') setLang('en');
    if (o) { setSlug(o); void loadOrg(o); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function loadOrg(o: string) {
    setOrgErr(''); const r = await fetch(`/api/enter?o=${encodeURIComponent(o)}`, { cache: 'no-store' }).then(x => x.json()).catch(() => null);
    if (!r?.success) { setOrgErr(r?.error || T.ar.noOrg); setOrg(null); return; }
    setOrg(r.org); setStep('login'); setTimeout(() => noRef.current?.focus(), 50);
  }
  async function enter(e: React.FormEvent) {
    e.preventDefault(); if (!org) return; setBusy(true); setErr(''); setLockedUntil(null); setRemaining(null);
    const r = await fetch('/api/enter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ o: org.slug, no: no.trim(), pin: pin.trim() }) }).then(x => x.json()).catch(() => null);
    setBusy(false);
    if (!r?.success) { setErr(r?.error || '…'); setLockedUntil(r?.locked_until || null); setRemaining(typeof r?.remaining === 'number' ? r.remaining : null); setPin(''); return; }
    try { await supabase().auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token }); } catch { /* الجلسة تُحفظ في المتصفح */ }
    try { sessionStorage.removeItem('athar:policy'); if (org.kiosk_minutes) localStorage.setItem('athar:kiosk', String(org.kiosk_minutes)); } catch { /* خاص */ }
    setToken(r.access_token); setFirst(!!r.first_login); setPinChanged(!!r.pin_changed);
    if (r.first_login) setStep('charter'); else if (!r.pin_changed) setStep('pin'); else finish();
  }
  function finish() { setStep('done'); window.location.href = '/me'; }
  async function saveNick() {
    setBusy(true); await fetch('/api/me/policy', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'epithet', id: nick, lang }) }).catch(() => null); setBusy(false);
    if (!pinChanged) setStep('pin'); else finish();
  }
  async function changePin(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setNote('');
    const r = await fetch('/api/me/policy', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'change_pin', current: cur, next: nxt }) }).then(x => x.json()).catch(() => null);
    setBusy(false); if (!r?.success) { setNote(r?.error || '…'); return; } setNote(t.changed); setTimeout(finish, 900);
  }
  const lockMin = lockedUntil ? Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60000)) : 0;

  return (
    <main dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang} style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0f2a4e,#0b8a83)', display: 'grid', placeItems: 'center', padding: 16, fontFamily: 'Tahoma,Arial,sans-serif' }} data-testid="enter-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="en-card" aria-live="polite">
        <div className="en-top">
          <span className="en-brand">أَثَر</span>
          <button type="button" className="en-lang" onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')} aria-label="Switch language" data-testid="enter-lang">{lang === 'ar' ? 'English' : 'العربية'}</button>
        </div>
        {org && <p className="en-org" data-testid="enter-org">{lang === 'en' && org.name_en ? org.name_en : org.name_ar}</p>}
        <h1 className="en-h1">{step === 'charter' ? t.charterT : step === 'nick' ? t.nickT : step === 'pin' ? t.pinT : t.title}</h1>

        {step === 'org' && <form onSubmit={(e) => { e.preventDefault(); void loadOrg(slug.trim().toLowerCase()); }} className="en-form">
          <label className="en-label" htmlFor="en-slug">{t.orgQ}</label>
          <input id="en-slug" className="en-input" dir="ltr" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="bg-east" autoComplete="off" data-testid="enter-slug" />
          <p className="en-hint">{t.orgHint}</p>
          {orgErr && <p className="en-err" role="alert" data-testid="enter-org-err">{orgErr}</p>}
          <button type="submit" className="en-btn" data-testid="enter-org-go">{t.orgGo}</button>
        </form>}

        {step === 'login' && org && (!org.code_login ? <p className="en-err" role="alert" data-testid="enter-notcode">{t.notCode} — <Link href="/login" style={{ color: '#fff' }}>{t.login}</Link></p> : org.frozen ? <p className="en-err" role="alert">{t.frozen}</p> :
          <form onSubmit={enter} className="en-form">
            <p className="en-sub">{t.sub}</p>
            <label className="en-label" htmlFor="en-no">{t.no}</label>
            <input id="en-no" ref={noRef} className="en-input" dir="ltr" inputMode="text" autoComplete="username" value={no} onChange={(e) => setNo(e.target.value)} maxLength={32} required data-testid="enter-no" />
            <label className="en-label" htmlFor="en-pin">{t.pin}</label>
            <input id="en-pin" className="en-input en-pin" dir="ltr" type="password" inputMode="numeric" pattern="[0-9]{6}" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} required data-testid="enter-pin" />
            {err && <p className="en-err" role="alert" data-testid="enter-err">{err}{lockMin ? ` — ${t.tryAt} ${lockMin} ${t.min}` : ''}{remaining != null && remaining > 0 ? ` (${remaining} ${t.remain})` : ''}</p>}
            <button type="submit" className="en-btn" disabled={busy || pin.length !== 6 || !no.trim()} data-testid="enter-go">{busy ? t.busy : t.go}</button>
            {!!org.kiosk_minutes && <p className="en-hint">{t.kiosk} {org.kiosk_minutes} {t.min}</p>}
            <p className="en-hint">{t.help}</p>
          </form>)}

        {step === 'charter' && <div className="en-form" data-testid="enter-charter">
          <ol className="en-charter">{t.charter.map((c, i) => <li key={i}>{c}</li>)}</ol>
          <button type="button" className="en-btn" onClick={() => setStep('nick')} data-testid="enter-agree">{t.agree}</button>
        </div>}

        {step === 'nick' && <div className="en-form" data-testid="enter-nick">
          <p className="en-sub">{t.nickHint}</p>
          <div className="en-chips" role="radiogroup" aria-label={t.nickT}>
            <button type="button" className={`en-chip${nick === 'none' ? ' on' : ''}`} onClick={() => setNick('none')} role="radio" aria-checked={nick === 'none'}>{t.nickNone}</button>
            {EPITHETS.map(e => <button key={e.id} type="button" className={`en-chip${nick === e.id ? ' on' : ''}`} onClick={() => setNick(e.id)} role="radio" aria-checked={nick === e.id} data-testid={`enter-ep-${e.id}`}>{lang === 'en' ? e.en : e.ar}</button>)}
          </div>
          <button type="button" className="en-btn" onClick={() => void saveNick()} disabled={busy} data-testid="enter-nick-save">{busy ? t.busy : t.nickSave}</button>
        </div>}

        {step === 'pin' && <form onSubmit={changePin} className="en-form" data-testid="enter-pinchange">
          <p className="en-sub">{t.pinHint}</p>
          <label className="en-label" htmlFor="en-cur">{t.cur}</label>
          <input id="en-cur" className="en-input en-pin" dir="ltr" type="password" inputMode="numeric" value={cur} onChange={(e) => setCur(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} data-testid="enter-cur" />
          <label className="en-label" htmlFor="en-nxt">{t.nxt}</label>
          <input id="en-nxt" className="en-input en-pin" dir="ltr" type="password" inputMode="numeric" value={nxt} onChange={(e) => setNxt(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} data-testid="enter-nxt" />
          {note && <p className={note === t.changed ? 'en-ok' : 'en-err'} role="status" data-testid="enter-pin-note">{note}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="en-btn" disabled={busy || cur.length !== 6 || nxt.length !== 6} data-testid="enter-pin-go">{busy ? t.busy : t.change}</button>
            <button type="button" className="en-btn ghost" onClick={finish} data-testid="enter-pin-later">{t.later}</button>
          </div>
        </form>}

        {step === 'done' && <p className="en-sub">…</p>}

        <nav className="en-links" aria-label="links"><Link href="/">{t.home}</Link><Link href="/login">{t.login}</Link></nav>
      </section>
    </main>
  );
}

const CSS = `
.en-card{width:100%;max-width:440px;background:#fff;border-radius:22px;padding:22px 22px 16px;box-shadow:0 30px 70px rgba(0,0,0,.35);color:#0f172a}
.en-top{display:flex;justify-content:space-between;align-items:center}.en-brand{font-weight:900;color:#0f2a4e;font-size:22px}
.en-lang{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:4px 12px;font-size:13px;cursor:pointer}
.en-org{margin:14px 0 0;color:#0b8a83;font-weight:800;font-size:15px}.en-h1{margin:4px 0 10px;font-size:24px;color:#0f2a4e}
.en-sub{margin:0 0 10px;color:#475569;font-size:14px}.en-form{display:flex;flex-direction:column;gap:8px}
.en-label{font-weight:700;font-size:14px;color:#334155}.en-input{border:1.5px solid #cbd5e1;border-radius:12px;padding:14px;font-size:20px;width:100%;box-sizing:border-box;text-align:center;letter-spacing:.06em}
.en-pin{letter-spacing:.5em;font-size:26px}.en-input:focus{outline:3px solid #c9a24b;border-color:#0b8a83}
.en-btn{margin-top:6px;border:0;border-radius:12px;background:#0b8a83;color:#fff;font-weight:800;font-size:18px;padding:14px;cursor:pointer;width:100%}.en-btn:disabled{opacity:.5;cursor:default}.en-btn.ghost{background:#e2e8f0;color:#0f2a4e}
.en-hint{margin:2px 0 0;color:#64748b;font-size:12.5px}.en-err{margin:4px 0;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:8px 10px;font-size:14px}.en-ok{color:#047857;font-weight:800}
.en-charter{margin:0;padding-inline-start:20px;color:#334155;line-height:1.7;font-size:14.5px}.en-charter li{margin-bottom:6px}
.en-chips{display:flex;flex-wrap:wrap;gap:6px}.en-chip{border:1.5px solid #cbd5e1;background:#fff;border-radius:999px;padding:6px 12px;font-size:14px;cursor:pointer}.en-chip.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.en-links{display:flex;gap:16px;justify-content:center;margin-top:16px;font-size:13px}.en-links a{color:#0b8a83;text-decoration:none;font-weight:700}
@media(min-width:900px){.en-card{max-width:480px}}@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;
