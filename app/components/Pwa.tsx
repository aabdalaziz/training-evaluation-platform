'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — PWA (P13-ب): تسجيل عامل الخدمة + زر الاشتراك في إشعار «موقف اليوم» (Web Push بلا اعتماديات) + تلميح التثبيت

import { useCallback, useEffect, useState } from 'react';

/** يسجّل /sw.js مرة واحدة (في المتصفحات الداعمة) — يوضع في app/layout.tsx */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const t = setTimeout(() => { navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* بلا PWA */ }); }, 1500);
    return () => clearTimeout(t);
  }, []);
  return null;
}

function toKey(b64u: string): Uint8Array { const pad = '='.repeat((4 - (b64u.length % 4)) % 4); const raw = atob((b64u + pad).replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out; }
export type PushState = 'loading' | 'unsupported' | 'server_off' | 'idle' | 'denied' | 'busy' | 'on' | 'ios_install';
export function isIosNotStandalone(): boolean { if (typeof navigator === 'undefined') return false; const ios = /iphone|ipad|ipod/i.test(navigator.userAgent); const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone === true; return ios && !standalone; }

/** زر «ذكّرني بموقف الغد» — يعمل للزائر والمستخدم؛ المستخدم يُربط اشتراكه بحسابه ويصله إشعار تجريبي فوري */
export function PushOptIn({ lang, tok, compact }: { lang: 'ar' | 'en'; tok?: string; compact?: boolean }) {
  const ar = lang === 'ar'; const [st, setSt] = useState<PushState>('loading'); const [key, setKey] = useState(''); const [msg, setMsg] = useState('');
  const hdr = useCallback(() => ({ 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }), [tok]);
  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) { setSt(isIosNotStandalone() ? 'ios_install' : 'unsupported'); return; }
      try {
        const j = await fetch('/api/push', { headers: hdr() }).then(r => r.json()); if (!j?.enabled || !j.publicKey) { setSt('server_off'); return; } setKey(j.publicKey);
        if (Notification.permission === 'denied') { setSt('denied'); return; }
        const reg = await navigator.serviceWorker.getRegistration('/'); const sub = reg ? await reg.pushManager.getSubscription() : null;
        setSt(sub ? 'on' : 'idle');
      } catch { setSt('unsupported'); }
    })();
  }, [hdr]);
  async function enable() {
    setSt('busy'); setMsg('');
    try {
      const perm = await Notification.requestPermission(); if (perm !== 'granted') { setSt('denied'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' }); await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) as unknown as BufferSource });
      const j = await fetch('/api/push', { method: 'POST', headers: hdr(), body: JSON.stringify({ action: 'subscribe', subscription: sub.toJSON(), lang, topics: ['daily'] }) }).then(r => r.json());
      if (!j?.success) { setMsg(j?.error || 'x'); setSt('idle'); return; }
      setSt('on'); setMsg(ar ? 'تم — سيصلك موقف اليوم كل صباح (9 صباحًا بتوقيت الرياض).' : 'Done — you’ll get the daily case every morning (9:00 Riyadh).');
      if (tok) fetch('/api/push', { method: 'POST', headers: hdr(), body: JSON.stringify({ action: 'test' }) }).catch(() => { /* تجاهل */ });
    } catch (e: any) { setMsg(String(e?.message || e)); setSt('idle'); }
  }
  async function disable() {
    setSt('busy');
    try { const reg = await navigator.serviceWorker.getRegistration('/'); const sub = reg ? await reg.pushManager.getSubscription() : null; if (sub) { await fetch('/api/push', { method: 'POST', headers: hdr(), body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint }) }); await sub.unsubscribe(); } } catch { /* تجاهل */ }
    setSt('idle'); setMsg('');
  }
  if (st === 'loading' || st === 'unsupported' || st === 'server_off') return null;
  const cls = compact ? 'pt-btn ghost small' : 'pt-btn light small';
  return (
    <span className="pw-wrap" style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
      {st === 'ios_install' && <small style={{ color: '#64748b', fontSize: 12 }}>{ar ? 'على iPhone: أضف أَثَر إلى الشاشة الرئيسية (مشاركة ← إضافة إلى الشاشة الرئيسية) ثم فعّل التذكير.' : 'On iPhone: add Athar to Home Screen first, then enable reminders.'}</small>}
      {st === 'denied' && <small style={{ color: '#64748b', fontSize: 12 }}>{ar ? 'الإشعارات محظورة في المتصفح — اسمح بها من إعدادات الموقع ثم أعد المحاولة.' : 'Notifications are blocked — allow them in site settings and retry.'}</small>}
      {(st === 'idle' || st === 'busy') && <button type="button" className={cls} disabled={st === 'busy'} onClick={enable} data-testid="push-optin">🔔 {st === 'busy' ? (ar ? 'لحظة…' : 'One moment…') : (ar ? 'ذكّرني بموقف الغد' : 'Remind me of tomorrow’s case')}</button>}
      {st === 'on' && <button type="button" className={cls} onClick={disable} title={ar ? 'إيقاف التذكير اليومي' : 'Turn off daily reminder'}>🔔 {ar ? 'التذكير اليومي مفعّل — إيقاف' : 'Daily reminder on — turn off'}</button>}
      {msg && <small style={{ color: msg.length > 60 || /تم|Done/.test(msg) ? '#166534' : '#991b1b', fontSize: 12 }}>{msg}</small>}
    </span>
  );
}
