'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر في الجيب (P19) — «بطاقة القدرة»: بطاقة بحجم الشاشة تُعرض في المقابلة أو عند بوابة الجهة بلا اتصال
 *  الاسم · أعلى 3 مستويات (المعتمَد بشريًا أولًا) · QR لرابط التحقق المستقل للقطة الموقَّعة · بصمة مفتاح أَثَر
 *  البيانات من حزمة الجيب (/api/pocket?view=bundle) — يخزّنها sw.js فتعمل بلا اتصال، مع سطر صدق صريح عن عمر النسخة
 *  حفظ PNG للمعرض (SVG → Canvas) · مشاركة عبر Web Share إن وُجد
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PortalShell, useLang } from '../../components/PortalShell';
import { useOutbox, valueMoment } from '../../components/Pocket';
import { capabilityCard, cardSvg, offlineLine } from '../../../lib/portal/pocket';
import { qrSvg } from '../../../lib/certificates/qr';
import { supabase } from '../../../lib/supabase/client';

type Bundle = { profile: { name: string; email: string }; levels: { name_ar: string; name_en?: string | null; level: number; approved: boolean }[]; snapshot: { code: string; issued_at: string; expires_at: string | null } | null; fingerprint: string | null; site: string; generated_at: string };
export default function CardPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const ob = useOutbox(); const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [b, setB] = useState<Bundle | null>(null); const [cachedAt, setCachedAt] = useState<string | null>(null); const [stale, setStale] = useState(false); const [status, setStatus] = useState(0); const [msg, setMsg] = useState('');
  useEffect(() => { db.auth.getSession().then(({ data }) => setTok(data.session?.access_token || '')); }, [db]);
  useEffect(() => { if (!tok) return; (async () => { try { const r = await fetch('/api/pocket?view=bundle', { headers: { Authorization: `Bearer ${tok}` } }); setStatus(r.status); setCachedAt(r.headers.get('X-Athar-Cached-At')); setStale(r.headers.get('X-Athar-Cache') === 'stale'); const j = await r.json().catch(() => null); if (j?.success) setB(j); } catch { setStatus(0); } })(); }, [tok, ob.online]);
  const site = typeof location !== 'undefined' ? location.origin : (b?.site || '');
  const card = b ? capabilityCard({ name: b.profile.name, email: b.profile.email, levels: b.levels, snapshot: b.snapshot, fingerprint: b.fingerprint, site }) : null;
  const qr = card?.verify_url ? qrSvg(card.verify_url, 140, 'M', '#0f2a4e') : null;
  const svg = card ? cardSvg(card, qr) : '';
  const toPng = () => new Promise<Blob | null>(res => { const img = new Image(); const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })); img.onload = () => { const c = document.createElement('canvas'); c.width = 1200; c.height = 680; const g = c.getContext('2d'); if (!g) return res(null); g.drawImage(img, 0, 0, 1200, 680); URL.revokeObjectURL(url); c.toBlob(bl => res(bl), 'image/png'); }; img.onerror = () => res(null); img.src = url; });
  const save = async () => { const bl = await toPng(); if (!bl) { setMsg(ar ? 'تعذّر التحويل' : 'Failed'); return; } const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = `athar-card-${card?.code || 'me'}.png`; a.click(); setMsg(ar ? 'حُفظت البطاقة.' : 'Saved.'); valueMoment('card_saved'); };
  const share = async () => { try { const bl = await toPng(); const nav: any = navigator; if (bl && nav.share && nav.canShare?.({ files: [new File([bl], 'athar-card.png', { type: 'image/png' })] })) { await nav.share({ title: ar ? 'بطاقة قدرتي — أَثَر' : 'My capability card', text: card?.verify_url || '', files: [new File([bl], 'athar-card.png', { type: 'image/png' })] }); return; } if (nav.share) { await nav.share({ title: 'أَثَر', url: card?.verify_url || site }); return; } await navigator.clipboard.writeText(card?.verify_url || site); setMsg(ar ? 'نُسخ رابط التحقق.' : 'Verify link copied.'); } catch { /* أُلغي */ } };
  return (
    <main className="pt-main" dir={ar ? 'rtl' : 'ltr'} style={{ maxWidth: 720, margin: '0 auto', padding: '18px 16px 96px' }}>
      <style dangerouslySetInnerHTML={{ __html: `.cd-wrap{background:#0b1220;border-radius:24px;padding:14px;display:grid;place-items:center}.cd-wrap svg{width:100%;height:auto;max-width:600px;border-radius:20px}.cd-acts{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.cd-line{font-size:13px;color:#475569;line-height:1.8}` }} />
      <h1 style={{ color: '#0f2a4e', fontSize: 22, margin: '0 0 4px' }}>{ar ? 'بطاقة قدرتي' : 'My capability card'}</h1>
      <p className="pt-muted" style={{ marginTop: 0 }}>{ar ? 'أرِها في المقابلة أو عند بوابة الجهة — من يمسحها يتحقق مستقلًا من توقيع أَثَر دون أن يدخل أَثَر.' : 'Show it at an interview — scanning verifies Athar’s signature independently.'}</p>
      {tok === '' && <div className="pt-box">{ar ? 'سجّل الدخول لعرض بطاقتك.' : 'Sign in to see your card.'} <Link href="/login">{ar ? 'تسجيل الدخول' : 'Sign in'}</Link></div>}
      {tok && !b && status > 0 && <div className="pt-box" data-testid="card-none">{status === 503 ? (ar ? 'لا نسخة محلية بعد — افتح هذه الصفحة مرة مع اتصال وستبقى في جيبك.' : 'No local copy yet — open once online.') : (ar ? 'تعذّر تحميل البطاقة.' : 'Could not load.')}</div>}
      {card && <>
        <div className="cd-wrap" data-testid="card" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="cd-line" data-testid="card-line">{offlineLine(stale ? cachedAt : null, ob.online, lang)}{card.code ? '' : (ar ? ' · لا لقطة موقَّعة بعد: أصدرها من «محفظتي السيادية» في توأمي ليظهر رمز QR.' : ' · No signed snapshot yet.')}</p>
        <div className="cd-acts"><button className="pt-btn gold" onClick={save} data-testid="card-save">{ar ? 'احفظ PNG' : 'Save PNG'}</button><button className="pt-btn" onClick={share}>{ar ? 'شارك' : 'Share'}</button><Link href="/me/twin" className="pt-btn ghost" style={{ background: '#f1f5f9', color: '#0f2a4e' }}>{ar ? 'المحفظة الكاملة' : 'Full wallet'}</Link>{card.verify_url && <a className="pt-btn ghost" style={{ background: '#f1f5f9', color: '#0f2a4e' }} href={card.verify_url} target="_blank" rel="noreferrer">{ar ? 'رابط التحقق' : 'Verify link'}</a>}</div>
        {msg && <p className="pt-muted">{msg}</p>}
        <div className="pt-box" style={{ fontSize: 13, lineHeight: 1.9 }}>
          <b>{ar ? 'ما الذي تثبته البطاقة؟' : 'What does it prove?'}</b>
          <p style={{ margin: '4px 0' }}>{ar ? `المستويات الثلاثة الأعلى في ملفك (${card.top.filter(t => t.approved).length} معتمَد بشريًا). رمز QR يفتح صفحة تحقق مستقلة تفحص توقيع Ed25519 وقائمة الإلغاء. النسخة المحلية لا تعرف عن إلغاءٍ حدث بعد آخر تحديث — ولهذا يُفحص الرمز دائمًا عند الجهة المتحقِّقة لا على جهازك.` : 'Top 3 levels; the QR opens independent verification (Ed25519 + status list). The local copy cannot know about revocations after its last update — verification always happens on the verifier’s side.'}</p>
        </div>
      </>}
    </main>
  );
}
