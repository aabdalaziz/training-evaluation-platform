'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /verify/grad?code=ATH-GD-XXXX-XXXX — P63: تحقّق عام من «صفحة التخرّج الذاتية» بالرمز والبصمة — البرنامج وتاريخ الختم وسلامة البصمة؛ الإبطال فوري ومعلَن؛ الرمز المستبدَل بختم أحدث يُقال عنه ذلك. لا يُعرض المحتوى هنا — الوجه العام في /g/<code> إن فتحه صاحبه. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../components/PortalShell';
import { Icon } from '../../../lib/ui/icons';

type R = { valid: boolean; revoked?: boolean; replaced?: boolean; intact?: boolean; sealed_at?: string; digest?: string; program_ar?: string; end?: string; public?: boolean; code?: string };
const fmt = (iso?: string) => { if (!iso) return ''; try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso; } };

export default function VerifyGradPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const [code, setCode] = useState(''); const [r, setR] = useState<R | null>(null); const [busy, setBusy] = useState(false);
  async function check(c: string) { const v = c.trim().toUpperCase(); if (!v) return; setBusy(true); const res = await fetch(`/api/verify/grad?code=${encodeURIComponent(v)}`, { cache: 'no-store' }).then((x) => x.json()).catch(() => null); setR(res && res.success ? res : { valid: false }); setBusy(false); }
  useEffect(() => { const c = new URLSearchParams(window.location.search).get('code') || ''; if (c) { setCode(c.toUpperCase()); void check(c); } }, []);
  return <main className="pt-main" dir="rtl" data-testid="vg-root">
    <section className="pt-box" style={{ maxWidth: 900, margin: '0 auto' }}>
      <p className="pt-muted" style={{ margin: 0, color: '#b45309', fontWeight: 800 }}>أَثَر · P63 · صفحة التخرّج الذاتية للمتدرّب</p>
      <h1 style={{ margin: '4px 0' }}>تحقّق من «صفحة تخرّج»</h1>
      <p className="pt-muted">أدخل الرمز (مثل ATH-GD-7K2Q-9M4X). نُظهر البرنامج وتاريخ الختم وسلامة البصمة — <b>ولا نُظهر الصفحة نفسها</b>؛ وجهها العام في رابطها /g/… إن فتحه صاحبها، وبما اختاره هو فقط. الإبطال فوري ومعلَن.</p>
      <form onSubmit={(e) => { e.preventDefault(); void check(code); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ATH-GD-XXXX-XXXX" aria-label="رمز الصفحة" style={{ flex: 1, minWidth: 220, border: '1.5px solid #cbd5e1', borderRadius: 10, padding: '9px 12px', fontFamily: 'inherit', fontSize: 15, letterSpacing: 1 }} data-testid="vg-code" />
        <button type="submit" className="pt-btn" disabled={busy} data-testid="vg-check"><Icon name="search" size={14} /> {busy ? '…' : 'تحقّق'}</button>
      </form>
      {r && !r.valid && !r.revoked && <div role="alert" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px', fontWeight: 800 }} data-testid="vg-invalid">لا توجد صفحة بهذا الرمز.</div>}
      {r && r.revoked && <div role="alert" style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa', borderRadius: 12, padding: '10px 14px', fontWeight: 800 }} data-testid="vg-revoked" data-replaced={r.replaced ? 1 : 0}>{r.replaced ? 'أُبطل هذا الرمز لأن صاحبه ختم صفحته ختمًا أحدث يحلّ محلّه.' : 'أُبطلت هذه الصفحة — أبطلها صاحبها.'}{r.sealed_at ? ` كانت قد خُتمت في ${fmt(r.sealed_at)}.` : ''} الإبطال فوري ومعلَن.</div>}
      {r && r.valid && <div data-testid="vg-valid">
        <div style={{ background: r.intact ? '#f0fdf4' : '#fef2f2', color: r.intact ? '#166534' : '#b91c1c', border: `1px solid ${r.intact ? '#bbf7d0' : '#fecaca'}`, borderRadius: 12, padding: '10px 14px', fontWeight: 800 }}>{r.intact ? '✓ صفحة صحيحة والبصمة سليمة — لم تتغيّر منذ ختمها' : '⚠ الرمز موجود لكن البصمة لا تطابق المحتوى'}</div>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', margin: '12px 0' }}>
          <dt className="pt-muted">النوع</dt><dd style={{ margin: 0 }}>صفحة تخرّج ذاتية — كتبها المتدرّب بنفسه مما كتبه بيده في برنامجه</dd>
          <dt className="pt-muted">البرنامج</dt><dd style={{ margin: 0, fontWeight: 800 }}>{r.program_ar}</dd>
          <dt className="pt-muted">انتهى</dt><dd style={{ margin: 0 }}>{r.end}</dd>
          <dt className="pt-muted">خُتمت</dt><dd style={{ margin: 0 }}>{fmt(r.sealed_at)}</dd>
          <dt className="pt-muted">البصمة</dt><dd style={{ margin: 0, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{r.digest}</dd>
          <dt className="pt-muted">الظهور</dt><dd style={{ margin: 0 }}>{r.public ? <>لها وجه عام: <Link href={`/g/${r.code}`} data-testid="vg-public-link">/g/{r.code}</Link></> : 'خاصّة — لا يُعرض المحتوى؛ البصمة والتاريخ فقط'}</dd>
        </dl>
      </div>}
      <p className="pt-muted" style={{ marginTop: 14 }}>الصفحة لا تُثبت تقييمًا ولا مستوى ولا شهادة؛ تُثبت البصمة أن ما كتبه صاحبها لم يتغيّر منذ ختمه. <Link href="/">الرئيسية</Link> · <Link href="/verify/map">تحقّق من خريطة أثر</Link> · <Link href="/verify">كل أنواع التحقّق</Link></p>
    </section>
  </main>;
}
