'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P82 */
/**
 * /me/pass — «بطاقة أَثَر الرقمية»: رمز QR موقَّع يُبرزه المشارك عند باب القاعة أو مكتب التسجيل
 *  فيقرؤه الطاقم من /admin/attendance («امسح بطاقة») وتُعبَّأ بياناته في ثوانٍ. الرمز لا يحمل اسمًا ولا بريدًا؛ يُحلّ على الخادم فقط.
 *  يُخزَّن الرمز محليًّا بعد أوّل تحميل ليعمل بلا اتصال · سطوع مرتفع للشاشة · حفظ PNG · صلاحية سنتان.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PortalShell, useLang } from '../../components/PortalShell';
import { fastToken } from '../../components/Pocket';
import { qrSvg } from '../../../lib/certificates/qr';
import { supabase } from '../../../lib/supabase/client';

const KEY = 'athar-pass-v1';
type Pass = { token: string; name: string; expires_at: string; cached_at: string };

export default function PassPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const db = useMemo(() => supabase(), []);
  const [p, setP] = useState<Pass | null>(null); const [state, setState] = useState<'loading' | 'ok' | 'offline' | 'anon' | 'error'>('loading'); const [msg, setMsg] = useState('');
  useEffect(() => {
    try { const c = JSON.parse(localStorage.getItem(KEY) || 'null') as Pass | null; if (c?.token) { setP(c); setState('ok'); } } catch { /* لا شيء */ }
    (async () => {
      const tk = await fastToken(db); if (!tk) { setState((s) => (s === 'ok' ? 'ok' : 'anon')); return; }
      try {
        const r = await fetch('/api/reader/card', { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }); const j = await r.json().catch(() => null);
        if (j?.success) { const np: Pass = { token: j.token, name: j.name, expires_at: j.expires_at, cached_at: new Date().toISOString() }; setP(np); localStorage.setItem(KEY, JSON.stringify(np)); setState('ok'); } else setState((s) => (s === 'ok' ? 'offline' : 'error'));
      } catch { setState((s) => (s === 'ok' ? 'offline' : 'error')); }
    })();
  }, [db]);
  const svg = p ? qrSvg(p.token, 280, 'M', '#22101F') : '';
  const savePng = () => { if (!svg) return; const img = new Image(); const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })); img.onload = () => { const c = document.createElement('canvas'); c.width = 720; c.height = 720; const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, 720, 720); x.drawImage(img, 60, 60, 600, 600); c.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'athar-pass.png'; a.click(); setMsg(ar ? 'حُفظت الصورة' : 'Saved'); }); URL.revokeObjectURL(url); }; img.src = url; };
  const exp = p ? new Date(p.expires_at).toLocaleDateString(ar ? 'ar-SA-u-nu-latn' : 'en-GB', { dateStyle: 'medium' }) : '';
  return (
    <div dir={ar ? 'rtl' : 'ltr'} style={{ maxWidth: 560, margin: '0 auto', padding: '8px 0 40px' }}>
      <style dangerouslySetInnerHTML={{ __html: `.ps-card{background:#fff;border:1px solid #e6d5c6;border-radius:24px;padding:22px;text-align:center;box-shadow:0 10px 30px rgba(34,16,31,.08)}.ps-card svg{width:min(280px,80vw);height:auto}.ps-name{font-size:22px;font-weight:800;color:#22101F;margin:12px 0 4px}.ps-sub{font-size:13px;color:#6b5560}.ps-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:14px}.ps-how{background:#F6EBE0;border-radius:16px;padding:14px 16px;margin-top:16px;font-size:14px;line-height:1.9;color:#3A1F36}` }} />
      <h1 style={{ fontSize: 22, color: '#3A1F36', margin: '0 0 12px' }}>{ar ? 'بطاقة أَثَر الرقمية' : 'Athar digital pass'}</h1>
      {state === 'loading' && !p && <p>{ar ? 'جارٍ الإصدار…' : 'Issuing…'}</p>}
      {state === 'anon' && <div className="ps-how">{ar ? 'سجّل الدخول لإصدار بطاقتك.' : 'Sign in to issue your pass.'} <Link href="/login?next=/me/pass" className="pt-btn" style={{ marginInlineStart: 8 }}>{ar ? 'دخول' : 'Sign in'}</Link></div>}
      {state === 'error' && !p && <div className="ps-how">{ar ? 'تعذّر إصدار البطاقة الآن — أعد المحاولة لاحقًا.' : 'Could not issue the pass now.'}</div>}
      {p && <div className="ps-card" data-testid="pass">
        <div dangerouslySetInnerHTML={{ __html: svg }} aria-label={ar ? 'رمز بطاقتك' : 'Your pass QR'} role="img" />
        <div className="ps-name">{p.name}</div>
        <div className="ps-sub">{ar ? `صالحة حتى ${exp}` : `Valid until ${exp}`}{state === 'offline' ? (ar ? ' · نسخة محفوظة (بلا اتصال)' : ' · cached (offline)') : ''}</div>
        <div className="ps-acts"><button className="pt-btn gold" onClick={savePng}>{ar ? 'احفظ PNG' : 'Save PNG'}</button><Link href="/me/card" className="pt-btn ghost" style={{ background: '#F6EBE0', color: '#3A1F36' }}>{ar ? 'بطاقة القدرة' : 'Capability card'}</Link></div>
        {msg && <p className="ps-sub" aria-live="polite">{msg}</p>}
      </div>}
      <div className="ps-how">
        <b>{ar ? 'كيف تُستخدم؟' : 'How it works'}</b><br />
        {ar ? 'أبرز الرمز عند باب القاعة أو مكتب التسجيل؛ يمسحه الطاقم من شاشة الحضور فتُعبَّأ بياناتك (الاسم · البريد · الجوال) خلال ثوانٍ دون كتابة.' : 'Show the QR at the door or registration desk; staff scan it and your details are filled instantly.'}<br />
        <span style={{ color: '#6b5560', fontSize: 13 }}>{ar ? 'الرمز موقَّع ولا يحمل بياناتك؛ يُحلّ على خادم أَثَر لطاقم التسجيل فقط، ويُسجَّل كلّ استخدام.' : 'The QR is signed and carries no personal data; it is resolved server-side for staff only, and every use is logged.'}</span>
      </div>
    </div>
  );
}
