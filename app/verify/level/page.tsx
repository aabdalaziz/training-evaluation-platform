'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /verify/level?code=ATH-LV-XXXX-XXXX — P70: تحقّق عام من «صفحة المستوى — بكلمات المتدرّب» بالرمز والبصمة — البرنامج والمستوى وتاريخ الختم وسلامة البصمة؛ الإبطال فوري ومعلَن؛ الرمز المستبدَل بختم أحدث يُقال عنه ذلك. لا يُعرض المحتوى هنا — الوجه العام في /lv/<code> إن فتحه صاحبه. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../components/PortalShell';
import { Icon } from '../../../lib/ui/icons';

type R = { valid: boolean; revoked?: boolean; replaced?: boolean; intact?: boolean; sealed_at?: string; digest?: string; program_ar?: string; level_no?: number; public?: boolean; code?: string };
const fmt = (iso?: string) => { if (!iso) return ''; try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso; } };

export default function VerifyLevelPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const [code, setCode] = useState(''); const [r, setR] = useState<R | null>(null); const [busy, setBusy] = useState(false);
  async function check(c: string) { const v = c.trim().toUpperCase(); if (!v) return; setBusy(true); const res = await fetch(`/api/verify/level?code=${encodeURIComponent(v)}`, { cache: 'no-store' }).then((x) => x.json()).catch(() => null); setR(res && res.success ? res : { valid: false }); setBusy(false); }
  useEffect(() => { const c = new URLSearchParams(window.location.search).get('code') || ''; if (c) { setCode(c.toUpperCase()); void check(c); } }, []);
  return <main className="pt-main" dir="rtl" data-testid="vl-root">
    <section className="pt-box" style={{ maxWidth: 900, margin: '0 auto' }}>
      <p className="pt-muted" style={{ margin: 0, color: '#D4614A', fontWeight: 800 }}>أَثَر · P70 · صفحة المستوى — بكلمات المتدرّب</p>
      <h1 style={{ margin: '4px 0' }}>تحقّق من «صفحة مستوى»</h1>
      <p className="pt-muted">أدخل الرمز (مثل ATH-LV-7K2Q-9M4X). نُظهر البرنامج والمستوى وتاريخ الختم وسلامة البصمة — <b>ولا نُظهر الصفحة نفسها</b>؛ وجهها العام في رابطها /lv/… إن فتحه صاحبها، وبما اختاره هو فقط. الإبطال فوري ومعلَن.</p>
      <form onSubmit={(e) => { e.preventDefault(); void check(code); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ATH-LV-XXXX-XXXX" aria-label="رمز الصفحة" style={{ flex: 1, minWidth: 220, border: '1.5px solid #D9CBC2', borderRadius: 10, padding: '9px 12px', fontFamily: 'inherit', fontSize: 15, letterSpacing: 1 }} data-testid="vl-code" />
        <button type="submit" className="pt-btn" disabled={busy} data-testid="vl-check"><Icon name="search" size={14} /> {busy ? '…' : 'تحقّق'}</button>
      </form>
      {r && !r.valid && !r.revoked && <div role="alert" style={{ background: '#FBEDE7', color: '#B9544A', border: '1px solid #F3C4B6', borderRadius: 12, padding: '10px 14px', fontWeight: 800 }} data-testid="vl-invalid">لا توجد صفحة بهذا الرمز.</div>}
      {r && r.revoked && <div role="alert" style={{ background: '#FBF4EE', color: '#9A3A2A', border: '1px solid #F1D9A8', borderRadius: 12, padding: '10px 14px', fontWeight: 800 }} data-testid="vl-revoked" data-replaced={r.replaced ? 1 : 0}>{r.replaced ? 'أُبطل هذا الرمز لأن صاحبه ختم صفحته ختمًا أحدث يحلّ محلّه.' : 'أُبطلت هذه الصفحة — أبطلها صاحبها.'}{r.sealed_at ? ` كانت قد خُتمت في ${fmt(r.sealed_at)}.` : ''} الإبطال فوري ومعلَن.</div>}
      {r && r.valid && <div data-testid="vl-valid">
        <div style={{ background: r.intact ? '#E6F3F1' : '#FBEDE7', color: r.intact ? '#2F6B66' : '#B9544A', border: `1px solid ${r.intact ? '#BFE1DC' : '#F3C4B6'}`, borderRadius: 12, padding: '10px 14px', fontWeight: 800 }}>{r.intact ? '✓ صفحة صحيحة والبصمة سليمة — لم تتغيّر منذ ختمها' : '⚠ الرمز موجود لكن البصمة لا تطابق المحتوى'}</div>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', margin: '12px 0' }}>
          <dt className="pt-muted">النوع</dt><dd style={{ margin: 0 }}>صفحة مستوى — كتبها المتدرّب بنفسه مما كتبه وقاله في مستواه (لا درجة ولا قرار عبور)</dd>
          <dt className="pt-muted">البرنامج</dt><dd style={{ margin: 0, fontWeight: 800 }}>{r.program_ar} — المستوى {r.level_no}</dd>
          <dt className="pt-muted">خُتمت</dt><dd style={{ margin: 0 }}>{fmt(r.sealed_at)}</dd>
          <dt className="pt-muted">البصمة</dt><dd style={{ margin: 0, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{r.digest}</dd>
          <dt className="pt-muted">الظهور</dt><dd style={{ margin: 0 }}>{r.public ? <>لها وجه عام: <Link href={`/lv/${r.code}`} data-testid="vl-public-link">/lv/{r.code}</Link></> : 'خاصّة — لا يُعرض المحتوى؛ البصمة والتاريخ فقط'}</dd>
        </dl>
      </div>}
      <p className="pt-muted" style={{ marginTop: 14 }}>الصفحة لا تُثبت تقييمًا ولا مستوى لغويًّا ولا شهادة؛ تُثبت البصمة أن ما كتبه صاحبها لم يتغيّر منذ ختمه. <Link href="/">الرئيسة</Link> · <Link href="/verify/grad">تحقّق من صفحة تخرّج</Link> · <Link href="/verify">كل أنواع التحقّق</Link></p>
    </section>
  </main>;
}
